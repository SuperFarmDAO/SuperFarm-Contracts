// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

// import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
// import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../../../access/PermitControlds.sol";
import "../../../proxy/StubProxyRegistry.sol";
import "./BlueprintSuper1155.sol";

/** 
  @title Diamond facet for Super1155's Transfer and Approval functions.
  @author Tim Clancy
  @author Qazawat Zirak
  @author Rostislav Khlebnikov
  @author Nikita Elunin
  This contract is a logic contract for delegate calls from the ProxyStorage.
  The contract defines the logic of Transfer/Approval of Super1155 assets and
  the storage of ProxyStorage is updated based on KECCAK256 memory locations.
  For the purpose of standardization, a facet should be less than 15KiloBytes.
  22 Dec, 2021.
*/
contract FacetTransferApproval is PermitControlds, ERC165Storage {
    using Address for address;
    using SafeERC20 for IERC20;

    /**
    An event that gets emitted when the proxy registry address is changed.
    @param oldRegistry The old proxy registry address.
    @param newRegistry The new proxy registry address.
  */
    event ChangeProxyRegistry(
        address indexed oldRegistry,
        address indexed newRegistry
    );

    /**
    @dev Equivalent to multiple {TransferSingle} events, where `operator`, `from` and `to` are the same for all
    transfers.
    @dev This event was explicitly declared to match IERC1155 standard.
  */
    event TransferBatch(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256[] ids,
        uint256[] values
    );

    /**
     @dev Emitted when `account` grants or revokes permission to `operator` to transfer their tokens, according to
     `approved`.
     @dev This event was explicitly declared to match IERC1155 standard.
  */
    event ApprovalForAll(
        address indexed account,
        address indexed operator,
        bool approved
    );

    /**
    An inheritable and configurable pre-transfer hook that can be overridden.
    It fires before any token transfer, including mints and burns.
    @param _operator The caller who triggers the token transfer.
    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _ids The specific token IDs to transfer.
    @param _amounts The amounts of the specific `_ids` to transfer.
    @param _data Additional call data to send with this transfer.
  */
    function _beforeTokenTransfer(
        address _operator,
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) internal virtual {}

    /**
    The batch equivalent of `_doSafeTransferAcceptanceCheck()`.
    @param _operator The caller who triggers the token transfer.
    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _ids The specific token IDs to transfer.
    @param _amounts The amounts of the specific `_ids` to transfer.
    @param _data Additional call data to send with this transfer.
  */

    function _doSafeBatchTransferAcceptanceCheck(
        address _operator,
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) private {
        if (_to.isContract()) {
            try
                IERC1155Receiver(_to).onERC1155BatchReceived(
                    _operator,
                    _from,
                    _ids,
                    _amounts,
                    _data
                )
            returns (bytes4 response) {
                if (
                    response !=
                    IERC1155Receiver(_to).onERC1155BatchReceived.selector
                ) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
    }

    /**
    Transfer on behalf of a caller or one of their authorized token managers
    items from one address to another.
    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _ids The specific token IDs to transfer.
    @param _amounts The amounts of the specific `_ids` to transfer.
    @param _data Additional call data to send with this transfer.
  */
    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public virtual {
        BlueprintSuper1155.Super1155StateVariables
            storage b = BlueprintSuper1155.super1155StateVariables();

        require(
            _ids.length == _amounts.length,
            "ERC1155: ids and amounts length mismatch"
        );
        require(_to != address(0), "ERC1155: transfer to the zero address");
        require(
            _from == _msgSender() || isApprovedForAll(_from, _msgSender()),
            "ERC1155: caller is not owner nor approved"
        );

        // An array to keep track of paidGroups for PerTransfer transfer Type.
        uint256[] memory paidGroup;

        // Validate transfer and perform all batch token sends.
        _beforeTokenTransfer(_msgSender(), _from, _to, _ids, _amounts, _data);
        for (uint256 i = 0; i < _ids.length; ++i) {
            // Retrieve the item's group ID.
            uint256 groupId = (_ids[i] & BlueprintSuper1155.GROUP_MASK) >> 128;
            uint256 ratioCut;

            // Check transfer type.
            if (
                b.itemGroups[groupId].transferData.transferType ==
                BlueprintSuper1155.TransferType.BoundToAddress
            ) {
                revert("Bound to Address");
            } else if (
                b.itemGroups[groupId].transferData.transferType ==
                BlueprintSuper1155.TransferType.TemporaryTransfer
            ) {
                require(
                    block.timestamp <=
                        b.itemGroups[groupId].transferData.transferTime,
                    "Transfer time is over"
                );
            }

            // Check transfer fee type.
            if (
                b.itemGroups[groupId].transferData.transferFeeType ==
                BlueprintSuper1155.TransferFeeType.PerTransfer
            ) {
                bool paid;
                for (uint256 j = 0; i < paidGroup.length; j++) {
                    if (paidGroup[j] == groupId) {
                        paid = true;
                        break;
                    }
                }
                if (!paid) {
                    uint256[] memory temp = paidGroup;
                    paidGroup = new uint256[](temp.length + 1);
                    for (uint256 j = 0; j < temp.length; j++) {
                        paidGroup[j] = temp[j];
                    }
                    paidGroup[paidGroup.length - 1] = groupId;
                    IERC20(b.itemGroups[groupId].transferData.transferToken)
                        .safeTransferFrom(
                            _from,
                            owner(),
                            b.itemGroups[groupId].transferData.transferFeeAmount
                        );
                }
            } else if (
                b.itemGroups[groupId].transferData.transferFeeType ==
                BlueprintSuper1155.TransferFeeType.PerItem
            ) {
                if (
                    b.itemGroups[groupId].itemType ==
                    BlueprintSuper1155.ItemType.Fungible
                ) {
                    IERC20(b.itemGroups[groupId].transferData.transferToken)
                        .safeTransferFrom(
                            _from,
                            owner(),
                            (b
                                .itemGroups[groupId]
                                .transferData
                                .transferFeeAmount * _amounts[i]) / 10000
                        );
                } else {
                    IERC20(b.itemGroups[groupId].transferData.transferToken)
                        .safeTransferFrom(
                            _from,
                            owner(),
                            b
                                .itemGroups[groupId]
                                .transferData
                                .transferFeeAmount * _amounts[i]
                        );
                }
            } else if (
                b.itemGroups[groupId].transferData.transferFeeType ==
                BlueprintSuper1155.TransferFeeType.RatioCut
            ) {
                if (
                    b.itemGroups[groupId].itemType ==
                    BlueprintSuper1155.ItemType.Fungible
                ) {
                    ratioCut =
                        (_amounts[i] *
                            b
                                .itemGroups[groupId]
                                .transferData
                                .transferFeeAmount) /
                        10000;
                }
            }

            // Update all specially-tracked group-specific balances.
            require(
                b.balances[_ids[i]][_from] >= _amounts[i],
                "ERC1155: insufficient balance for transfer"
            );
            b.balances[_ids[i]][_from] =
                b.balances[_ids[i]][_from] -
                _amounts[i];
            b.balances[_ids[i]][_to] =
                b.balances[_ids[i]][_to] +
                _amounts[i] -
                ratioCut;
            b.groupBalances[groupId][_from] =
                b.groupBalances[groupId][_from] -
                _amounts[i];
            b.groupBalances[groupId][_to] =
                b.groupBalances[groupId][_to] +
                _amounts[i] -
                ratioCut;
            b.totalBalances[_from] = b.totalBalances[_from] - _amounts[i];
            b.totalBalances[_to] =
                b.totalBalances[_to] +
                _amounts[i] -
                ratioCut;

            // Update RatioCut and RatioExtra fees.
            if (
                b.itemGroups[groupId].transferData.transferFeeType ==
                BlueprintSuper1155.TransferFeeType.RatioCut
            ) {
                b.balances[_ids[i]][owner()] =
                    b.balances[_ids[i]][owner()] +
                    ratioCut;
                b.groupBalances[groupId][owner()] =
                    b.groupBalances[groupId][owner()] +
                    ratioCut;
                b.totalBalances[owner()] = b.totalBalances[owner()] + ratioCut;
            }
        }

        // Emit the transfer event and perform the safety check.
        emit TransferBatch(_msgSender(), _from, _to, _ids, _amounts);
        _doSafeBatchTransferAcceptanceCheck(
            _msgSender(),
            _from,
            _to,
            _ids,
            _amounts,
            _data
        );
    }

    /**
    Allow the item collection owner or an approved manager to update the proxy
    registry address handling delegated approval.
    @param _proxyRegistryAddress The address of the new proxy registry to
      update to.
  */
    function setProxyRegistry(address _proxyRegistryAddress)
        external
        virtual
        hasValidPermit(UNIVERSAL, BlueprintSuper1155.SET_PROXY_REGISTRY)
    {
        BlueprintSuper1155.Super1155StateVariables
            storage b = BlueprintSuper1155.super1155StateVariables();

        address oldRegistry = b.proxyRegistryAddress;
        b.proxyRegistryAddress = _proxyRegistryAddress;
        emit ChangeProxyRegistry(oldRegistry, _proxyRegistryAddress);
    }

    /**
    This function returns true if `_operator` is approved to transfer items
    owned by `_owner`. This approval check features an override to explicitly
    whitelist any addresses delegated in the proxy registry.
    @param _owner The owner of items to check for transfer ability.
    @param _operator The potential transferrer of `_owner`'s items.
    @return Whether `_operator` may transfer items owned by `_owner`.
  */
    function isApprovedForAll(address _owner, address _operator)
        public
        view
        virtual
        returns (bool)
    {
        BlueprintSuper1155.Super1155StateVariables
            storage b = BlueprintSuper1155.super1155StateVariables();

        if (
            StubProxyRegistry(b.proxyRegistryAddress).proxies(_owner) ==
            _operator
        ) {
            return true;
        }

        // We did not find an explicit whitelist in the proxy registry.
        return b.operatorApprovals[_owner][_operator];
    }

    /**
    Enable or disable approval for a third party `_operator` address to manage
    (transfer or burn) all of the caller's tokens.
    @param _operator The address to grant management rights over all of the
      caller's tokens.
    @param _approved The status of the `_operator`'s approval for the caller.
  */
    function setApprovalForAll(address _operator, bool _approved)
        external
        virtual
    {
        BlueprintSuper1155.Super1155StateVariables
            storage b = BlueprintSuper1155.super1155StateVariables();

        require(
            _msgSender() != _operator,
            "ERC1155: setting approval status for self"
        );
        b.operatorApprovals[_msgSender()][_operator] = _approved;
        emit ApprovalForAll(_msgSender(), _operator, _approved);
    }

    /**
    Transfer on behalf of a caller or one of their authorized token managers
    items from one address to another.
    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _id The specific token ID to transfer.
    @param _amount The amount of the specific `_id` to transfer.
    @param _data Additional call data to send with this transfer.
  */
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes calldata _data
    ) external virtual {
        safeBatchTransferFrom(
            _from,
            _to,
            _asSingletonArray(_id),
            _asSingletonArray(_amount),
            _data
        );
    }

    /**
    This private helper function converts a number into a single-element array.
    @param _element The element to convert to an array.
    @return The array containing the single `_element`.
  */
    function _asSingletonArray(uint256 _element)
        private
        pure
        returns (uint256[] memory)
    {
        uint256[] memory array = new uint256[](1);
        array[0] = _element;
        return array;
    }
}

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
import "./BlueprintSuper1155.sol";

/** 
  @title Diamond facet for Super1155's Mint and Burn functions.
  @author Tim Clancy
  @author Qazawat Zirak
  @author Rostislav Khlebnikov
  @author Nikita Elunin
  This contract is a logic contract for delegate calls from the ProxyStorage.
  The contract defines the logic of Minting and Burning Super1155 assets and
  the storage of ProxyStorage is updated based on KECCAK256 memory locations.
  For the purpose of standardization, a facet should be less than 15KiloBytes.
  22 Dec, 2021.
*/
contract FacetMintBurn is PermitControlds, ERC165Storage {
    using Address for address;
    using SafeERC20 for IERC20;

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
    This is a private helper function to replace the `hasItemRight` modifier
    that we use on some functions in order to inline this check during batch
    minting and burning.
    @param _id The ID of the item to check for the given `_right` on.
    @param _right The right that the caller is trying to exercise on `_id`.
    @return Whether or not the caller has a valid right on this item.
  */
    function _hasItemRight(uint256 _id, bytes32 _right)
        private
        view
        returns (bool)
    {
        uint256 groupId = _id >> 128;
        if (_msgSender() == owner()) {
            return true;
        }
        if (hasRight(_msgSender(), UNIVERSAL, _right)) {
            return true;
        }
        if (hasRight(_msgSender(), bytes32(groupId), _right)) {
            return true;
        }
        if (hasRight(_msgSender(), bytes32(_id), _right)) {
            return true;
        }
        return false;
    }

    /**
    Retrieve the balance of a particular token `_id` for a particular address
    `_owner`.
    @param _owner The owner to check for this token balance.
    @param _id The ID of the token to check for a balance.
    @return The amount of token `_id` owned by `_owner`.
  */
    function balanceOf(address _owner, uint256 _id)
        public
        view
        virtual
        returns (uint256)
    {
        require(
            _owner != address(0),
            "ERC1155: balance query for the zero address"
        );

        BlueprintSuper1155.Super1155StateVariables
            storage b = BlueprintSuper1155.super1155StateVariables();

        return b.balances[_id][_owner];
    }

    /**
    Retrieve in a single call the balances of some mulitple particular token
    `_ids` held by corresponding `_owners`.
    @param _owners The owners to check for token balances.
    @param _ids The IDs of tokens to check for balances.
    @return the amount of each token owned by each owner.
  */
    function balanceOfBatch(address[] calldata _owners, uint256[] calldata _ids)
        external
        view
        virtual
        returns (uint256[] memory)
    {
        require(
            _owners.length == _ids.length,
            "ERC1155: accounts and ids length mismatch"
        );

        // Populate and return an array of balances.
        uint256[] memory batchBalances = new uint256[](_owners.length);
        for (uint256 i = 0; i < _owners.length; ++i) {
            batchBalances[i] = balanceOf(_owners[i], _ids[i]);
        }
        return batchBalances;
    }

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
    This is a private helper function to verify, according to all of our various
    minting and burning rules, whether it would be valid to mint some `_amount`
    of a particular item `_id`.
    @param _id The ID of the item to check for minting validity.
    @param _amount The amount of the item to try checking mintability for.
    @return The ID of the item that should have `_amount` minted for it.
  */
    function _mintChecker(uint256 _id, uint256 _amount)
        private
        view
        returns (uint256)
    {
        BlueprintSuper1155.Super1155StateVariables
            storage b = BlueprintSuper1155.super1155StateVariables();

        // Retrieve the item's group ID.
        uint256 shiftedGroupId = (_id & BlueprintSuper1155.GROUP_MASK);
        uint256 groupId = shiftedGroupId >> 128;
        require(
            b.itemGroups[groupId].initialized,
            "Super1155: you cannot mint a non-existent item group"
        );

        // If we can replenish burnt items, then only our currently-circulating
        // supply matters. Otherwise, historic mints are what determine the cap.
        uint256 currentGroupSupply = b.itemGroups[groupId].mintCount;
        uint256 currentItemSupply = b.mintCount[_id];
        if (
            b.itemGroups[groupId].burnType ==
            BlueprintSuper1155.BurnType.Replenishable
        ) {
            currentGroupSupply = b.itemGroups[groupId].circulatingSupply;
            currentItemSupply = b.circulatingSupply[_id];
        }

        // If we are subject to a cap on group size, ensure we don't exceed it.
        if (
            b.itemGroups[groupId].supplyType !=
            BlueprintSuper1155.SupplyType.Uncapped
        ) {
            require(
                (currentGroupSupply + _amount) <=
                    b.itemGroups[groupId].supplyData,
                "Super1155: you cannot mint a group beyond its cap"
            );
        }

        // Do not violate nonfungibility rules.
        if (
            b.itemGroups[groupId].itemType ==
            BlueprintSuper1155.ItemType.Nonfungible
        ) {
            require(
                (currentItemSupply + _amount) <= 1,
                "Super1155: you cannot mint more than a single nonfungible item"
            );

            // Do not violate semifungibility rules.
        } else if (
            b.itemGroups[groupId].itemType ==
            BlueprintSuper1155.ItemType.Semifungible
        ) {
            require(
                (currentItemSupply + _amount) <= b.itemGroups[groupId].itemData,
                "Super1155: you cannot mint more than the alloted semifungible items"
            );
        }

        // Fungible items are coerced into the single group ID + index one slot.
        uint256 mintedItemId = _id;
        if (
            b.itemGroups[groupId].itemType ==
            BlueprintSuper1155.ItemType.Fungible
        ) {
            mintedItemId = shiftedGroupId + 1;
        }
        return mintedItemId;
    }

    /**
    Mint a batch of tokens into existence and send them to the `_recipient`
    address. In order to mint an item, its item group must first have been
    created. Minting an item must obey both the fungibility and size cap of its
    group.
    @param _recipient The address to receive all NFTs within the newly-minted
      group.
    @param _ids The item IDs for the new items to create.
    @param _amounts The amount of each corresponding item ID to create.
    @param _data Any associated data to use on items minted in this transaction.
  */
    function mintBatch(
        address _recipient,
        uint256[] calldata _ids,
        uint256[] calldata _amounts,
        bytes calldata _data
    ) external payable {
        require(_recipient != address(0), "ERC1155: mint to the zero address");
        require(
            _ids.length == _amounts.length,
            "ERC1155: ids and amounts length mismatch"
        );

        BlueprintSuper1155.Super1155StateVariables
            storage b = BlueprintSuper1155.super1155StateVariables();

        // Validate and perform the mint.
        address operator = _msgSender();
        _beforeTokenTransfer(
            operator,
            address(0),
            _recipient,
            _ids,
            _amounts,
            _data
        );

        // Loop through each of the batched IDs to update storage of special
        // balances and circulation balances.
        uint256 etherValue = msg.value;
        for (uint256 i = 0; i < _ids.length; i++) {
            require(
                _hasItemRight(_ids[i], BlueprintSuper1155.MINT),
                "Super1155: you do not have the right to mint that item"
            );

            // Retrieve the group ID from the given item `_id`.
            uint256 groupId = _ids[i] >> 128;

            // Add supplyData if the supplyTime was time dependent.
            if (
                b.itemGroups[groupId].supplyType ==
                BlueprintSuper1155.SupplyType.TimeValue
            ) {
                uint256 intervals = (block.timestamp -
                    b.itemGroups[groupId].timeData.timeStamp) /
                    b.itemGroups[groupId].timeData.timeInterval;
                b.itemGroups[groupId].supplyData +=
                    intervals *
                    b.itemGroups[groupId].timeData.timeRate;
            } else if (
                b.itemGroups[groupId].supplyType ==
                BlueprintSuper1155.SupplyType.TimePercent
            ) {
                uint256 intervals = (block.timestamp -
                    b.itemGroups[groupId].timeData.timeStamp) /
                    b.itemGroups[groupId].timeData.timeInterval;
                b.itemGroups[groupId].supplyData =
                    intervals *
                    b.itemGroups[groupId].timeData.timeStamp;
                if (
                    b.itemGroups[groupId].supplyData >
                    b.itemGroups[groupId].timeData.timeCap
                ) {
                    b.itemGroups[groupId].supplyData = b
                        .itemGroups[groupId]
                        .timeData
                        .timeCap;
                }
            }

            // Check mint.
            uint256 mintedItemId = _mintChecker(_ids[i], _amounts[i]);

            // Put intrinsic value in the token if the group is intrinsic.
            if (b.itemGroups[groupId].intrinsicData.intrinsic) {
                uint256 requiredAmount = _amounts[i] *
                    b.itemGroups[groupId].intrinsicData.rate;
                address intrinsicToken = b
                    .itemGroups[groupId]
                    .intrinsicData
                    .intrinsicToken;

                // If sufficient prefund is available.
                if (
                    requiredAmount <=
                    b.itemGroups[groupId].intrinsicData.prefund
                ) {
                    b
                        .itemGroups[groupId]
                        .intrinsicData
                        .prefund -= requiredAmount;

                    // If minter locks new ERC20 tokens.
                } else if (intrinsicToken != address(0)) {
                    b
                        .itemGroups[groupId]
                        .intrinsicData
                        .totalLocked += requiredAmount;
                    IERC20(intrinsicToken).safeTransferFrom(
                        _msgSender(),
                        address(this),
                        requiredAmount
                    );

                    // If minter locks new Ether.
                } else if (requiredAmount <= etherValue) {
                    b
                        .itemGroups[groupId]
                        .intrinsicData
                        .totalLocked += requiredAmount;
                    etherValue -= requiredAmount;

                    // If insufficient intrinsic or extrinsic funds.
                } else {
                    revert("Insufficient intrinsic value or prefund");
                }
            }

            // Update storage of special balances and circulating values.
            b.balances[mintedItemId][_recipient] =
                b.balances[mintedItemId][_recipient] +
                _amounts[i];
            b.groupBalances[groupId][_recipient] =
                b.groupBalances[groupId][_recipient] +
                _amounts[i];
            b.totalBalances[_recipient] =
                b.totalBalances[_recipient] +
                _amounts[i];
            b.mintCount[mintedItemId] = b.mintCount[mintedItemId] + _amounts[i];
            b.circulatingSupply[mintedItemId] =
                b.circulatingSupply[mintedItemId] +
                _amounts[i];
            b.itemGroups[groupId].mintCount =
                b.itemGroups[groupId].mintCount +
                _amounts[i];
            b.itemGroups[groupId].circulatingSupply =
                b.itemGroups[groupId].circulatingSupply +
                _amounts[i];
        }

        // Emit event and handle the safety check.
        emit TransferBatch(operator, address(0), _recipient, _ids, _amounts);
        _doSafeBatchTransferAcceptanceCheck(
            operator,
            address(0),
            _recipient,
            _ids,
            _amounts,
            _data
        );
    }

    /**
    This is a private helper function to verify, according to all of our various
    minting and burning rules, whether it would be valid to burn some `_amount`
    of a particular item `_id`.
    @param _id The ID of the item to check for burning validity.
    @param _amount The amount of the item to try checking burning for.
    @return The ID of the item that should have `_amount` burnt for it.
  */
    function _burnChecker(uint256 _id, uint256 _amount)
        private
        view
        returns (uint256)
    {
        BlueprintSuper1155.Super1155StateVariables
            storage b = BlueprintSuper1155.super1155StateVariables();

        // Retrieve the item's group ID.
        uint256 shiftedGroupId = (_id & BlueprintSuper1155.GROUP_MASK);
        uint256 groupId = shiftedGroupId >> 128;
        require(
            b.itemGroups[groupId].initialized,
            "Super1155: you cannot burn a non-existent item group"
        );

        // If the item group is non-burnable, then revert.
        if (
            b.itemGroups[groupId].burnType == BlueprintSuper1155.BurnType.None
        ) {
            revert("Super1155: you cannot burn a non-burnable item group");
        }

        // If we can burn items, then we must verify that we do not exceed the cap.
        if (
            b.itemGroups[groupId].burnType ==
            BlueprintSuper1155.BurnType.Burnable
        ) {
            require(
                (b.itemGroups[groupId].burnCount + _amount) <=
                    b.itemGroups[groupId].burnData,
                "Super1155: you may not exceed the burn limit on this item group"
            );
        }

        // Fungible items are coerced into the single group ID + index one slot.
        uint256 burntItemId = _id;
        if (
            b.itemGroups[groupId].itemType ==
            BlueprintSuper1155.ItemType.Fungible
        ) {
            burntItemId = shiftedGroupId + 1;
        }
        return burntItemId;
    }

    /**
    This function allows an address to destroy multiple different items in a
    single call.
    @param _burner The address whose items are burning.
    @param _ids The item IDs to burn.
    @param _amounts The amounts of the corresponding item IDs to burn.
  */
    function burnBatch(
        address _burner,
        uint256[] memory _ids,
        uint256[] memory _amounts
    ) public virtual {
        require(_burner != address(0), "ERC1155: burn from the zero address");
        require(
            _ids.length == _amounts.length,
            "ERC1155: ids and amounts length mismatch"
        );

        BlueprintSuper1155.Super1155StateVariables
            storage b = BlueprintSuper1155.super1155StateVariables();

        // Validate and perform the burn.
        address operator = _msgSender();
        _beforeTokenTransfer(operator, _burner, address(0), _ids, _amounts, "");

        // Loop through each of the batched IDs to update storage of special
        // balances and circulation balances.
        for (uint256 i = 0; i < _ids.length; i++) {
            require(
                _hasItemRight(_ids[i], BlueprintSuper1155.BURN),
                "Super1155: you do not have the right to burn that item"
            );

            // Retrieve the group ID from the given item `_id` and check burn.
            uint256 groupId = _ids[i] >> 128;
            uint256 burntItemId = _burnChecker(_ids[i], _amounts[i]);

            // Update storage of special balances and circulating values.
            require(
                b.balances[burntItemId][_burner] >= _amounts[i],
                "ERC1155: burn amount exceeds balance"
            );
            b.balances[burntItemId][_burner] =
                b.balances[burntItemId][_burner] -
                _amounts[i];
            b.groupBalances[groupId][_burner] =
                b.groupBalances[groupId][_burner] -
                _amounts[i];
            b.totalBalances[_burner] = b.totalBalances[_burner] - _amounts[i];
            b.burnCount[burntItemId] = b.burnCount[burntItemId] + _amounts[i];
            b.circulatingSupply[burntItemId] =
                b.circulatingSupply[burntItemId] -
                _amounts[i];
            b.itemGroups[groupId].burnCount =
                b.itemGroups[groupId].burnCount +
                _amounts[i];
            b.itemGroups[groupId].circulatingSupply =
                b.itemGroups[groupId].circulatingSupply -
                _amounts[i];

            // If the token has intrinsic value.
            if (b.itemGroups[groupId].intrinsicData.intrinsic) {
                uint256 burnAmount = _amounts[i] *
                    b.itemGroups[groupId].intrinsicData.rate;
                uint256 burnShare = (burnAmount *
                    b.itemGroups[groupId].intrinsicData.burnShare) / 10000;
                address intrinsicToken = b
                    .itemGroups[groupId]
                    .intrinsicData
                    .intrinsicToken;

                // If the intrinsic value is ERC20.
                if (intrinsicToken != address(0)) {
                    b
                        .itemGroups[groupId]
                        .intrinsicData
                        .totalLocked -= burnAmount;
                    IERC20(intrinsicToken).safeTransfer(owner(), burnShare);
                    IERC20(intrinsicToken).safeTransfer(
                        _burner,
                        burnAmount - burnShare
                    );

                    // If the intrinsic value is Ether.
                } else {
                    b
                        .itemGroups[groupId]
                        .intrinsicData
                        .totalLocked -= burnAmount;
                    payable(owner()).transfer(burnShare);
                    payable(_burner).transfer(burnAmount - burnShare);
                }
            }
        }

        // Emit the burn event.
        emit TransferBatch(operator, _burner, address(0), _ids, _amounts);
    }

    /**
    This function allows an address to destroy some of its items.
    @param _burner The address whose item is burning.
    @param _id The item ID to burn.
    @param _amount The amount of the corresponding item ID to burn.
  */
    function burn(
        address _burner,
        uint256 _id,
        uint256 _amount
    ) external virtual {
        require(
            _hasItemRight(_id, BlueprintSuper1155.BURN),
            "Super1155: you don't have rights to burn"
        );
        burnBatch(_burner, _asSingletonArray(_id), _asSingletonArray(_amount));
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

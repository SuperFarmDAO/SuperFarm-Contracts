// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "./ISuper1155.sol"; // CHECK not that interface
import "./interfaces/ISuper721.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";
import "./Token.sol";
import "hardhat/console.sol";       // ATTENTION only for testing

/**
  @title A vault for securely holding tokens.
  @author Tim Clancy

  The purpose of this contract is to hold a single type of ERC-20 token securely
  behind a Compound Timelock governed by a Gnosis MultiSigWallet. Tokens may
  only leave the vault with multisignature permission and after passing through
  a mandatory timelock. The justification for the timelock is such that, if the
  multisignature wallet is ever compromised, the team will have two days to act
  in mitigating the potential damage from the attacker's `sentTokens` call. Such
  mitigation efforts may include calling `panic` from a separate, uncompromised
  and non-timelocked multisignature wallet, or finding some way to issue a new
  token entirely.
*/
contract TokenVault is Ownable, ReentrancyGuard, IERC721Receiver, ERC1155Holder {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    /// A version number for this TokenVault contract's interface.
    uint256 public version = 1;

    /// A user-specified, descriptive name for this TokenVault.
    string public name;

    /// The token to hold safe.
    address public token;

    /// Enumerable set that stores values of Super721 contract addresses
    EnumerableSet.AddressSet private super721Addresses; 

    /// Enumerable set that stores values of Super1155 contract addresses
    EnumerableSet.AddressSet private super1155Addresses; 

    /// map of token ids for Super721 and Super1155 contracts  
    mapping(address => Asset) assets;  

    enum AssetType {
        None,
        Eth,
        ERC20,
        ERC1155,
        ERC721
    }

    /**
    */ 
    struct Asset { 
        AssetType assetType;
        uint256[] amounts;
        uint256[] ids;
    }
  /**
    The panic owner is an optional address allowed to immediately send the
    contents of the vault to the address specified in `panicDestination`. The
    intention of this system is to support a series of cascading vaults secured
    by their own multisignature wallets. If, for instance, vault one is
    compromised via its attached multisignature wallet, vault two could
    intercede to save the tokens from vault one before the malicious token send
    clears the owning timelock.
  */
  address public panicOwner;

  /// An optional address where tokens may be immediately sent by `panicOwner`.
  address public panicDestination;

  /**
    A counter to limit the number of times a vault can panic before burning the
    underlying supply of tokens. This limit is in place to protect against a
    situation where multiple vaults linked in a circle are all compromised. In
    the event of such an attack, this still gives the original multisignature
    holders the chance to burn the tokens by repeatedly calling `panic` before
    the attacker can use `sendTokens`.
  */
  uint256 public panicLimit;

  /// A counter for the number of times this vault has panicked.
  uint256 public panicCounter;

  /// A flag to determine whether or not this vault can alter its `panicOwner` and `panicDestination`.
  bool public canAlterPanicDetails;

  /// An event for tracking a change in panic details.
  event PanicDetailsChange(address indexed panicOwner, address indexed panicDestination);

  /// An event for tracking a lock on alteration of panic details.
  event PanicDetailsLocked();

  /// An event for tracking a disbursement of tokens.
  event TokenSend(uint256 tokenAmount, uint256 etherAmount, uint256 amountSuper721, uint256 amountSuper1155);

  /// An event for tracking a panic transfer of tokens.
  event PanicTransfer(uint256 panicCounter, uint256 tokenAmount, uint256 etherAmount, uint256 amountSuper721, uint256 amountSuper1155, address indexed destination);

  /// An event for tracking a panic burn of tokens.
  event PanicBurn(uint256 panicCounter, uint256 tokenAmount, uint256 etherAmount, uint256 amountSuper721, uint256 amountSuper1155);

  /// An event that indicates that contract receives ether. 
  event Receive(address caller, uint256 amount);

  /// @dev a modifier which allows only `panicOwner` to call a function.
  modifier onlyPanicOwner() {
    require(panicOwner == _msgSender(),
      "TokenVault: caller is not the panic owner");
    _;
  }

  /**
    Construct a new TokenVault by providing it a name and the token to disburse.

    @param _name The name of the TokenVault.
    @param _token The token to store and disburse.
    @param _panicOwner The address to grant emergency withdrawal powers to.
    @param _panicDestination The destination to withdraw to in emergency.
    @param _panicLimit A limit for the number of times `panic` can be called before tokens burn.
  */
  constructor (string memory _name, address _token, address _panicOwner, address _panicDestination, uint256 _panicLimit) {
    name = _name;
    token = _token;
    panicOwner = _panicOwner;
    panicDestination = _panicDestination;
    panicLimit = _panicLimit;
    panicCounter = 0;
    canAlterPanicDetails = true;
    uint256 MAX_INT = 2**256 - 1;
    IERC20(token).approve(address(this), MAX_INT);
  }

  /**
    Allows the owner of the TokenVault to update the `panicOwner` and
    `panicDestination` details governing its panic functionality.

    @param _panicOwner The new panic owner to set.
    @param _panicDestination The new emergency destination to send tokens to.
  */
  function changePanicDetails(address _panicOwner, address _panicDestination) external nonReentrant onlyOwner {
    require(canAlterPanicDetails,
      "You cannot change panic details on a vault which is locked.");
    panicOwner = _panicOwner;
    panicDestination = _panicDestination;
    emit PanicDetailsChange(panicOwner, panicDestination);
  }
    /**
        add Super721 contract address to the set of addreses
        @param _super721 array with addresses of super721 contracts
     */
    function addSuper721Addr(address[] calldata _super721) external onlyOwner {
      for (uint256 i = 0; i < _super721.length; i++) {
        address super721 = _super721[i];
        require(!super721Addresses.contains(super721), "address of super721 already presented in set");
        super721Addresses.add(super721);
      }
    }
    
    /**
        add Super1155 contract addresses to the set of addreses
        @param _super1155 array with addresses of super1155 contracts
     */
    function addSuper1155Addr(address[] calldata _super1155) external onlyOwner {
      for (uint256 i = 0; i < _super1155.length; i++) {
        address super1155 = _super1155[i];
        require(!super1155Addresses.contains(super1155), "address of super1155 already presented in set");
        super1155Addresses.add(super1155);
      }
    }

    /** function for adding ERC1155 and ERC721 tokens to contract 
        @param _contrAddrs array of contracts addresses for which asset is added 
        @param _assets array of assets that added to contract  
     */
    function addTokens(address[] calldata _contrAddrs, Asset[] calldata _assets) external nonReentrant onlyOwner {
      require(_contrAddrs.length == _assets.length, "Number of contracts and assets should be the same");
 
      for (uint256 i = 0; i < _contrAddrs.length; i++) {
        require(super1155Addresses.contains(_contrAddrs[i]) || super721Addresses.contains(_contrAddrs[i]), "Address of token is not permited"); 
        require(_assets[i].assetType == AssetType.ERC721 || _assets[i].assetType == AssetType.ERC1155, "Type of asset isn't ERC721 or ERC1155");
        assets[_contrAddrs[i]] = (_assets[i]);
      }
      // TO_ASK add smth to emit
    }

  /**
    Allows the owner of the TokenVault to lock the vault to all future panic
    detail changes.
  */
  function lock() external nonReentrant onlyOwner {
    canAlterPanicDetails = false;
    emit PanicDetailsLocked();
  }

  /**
    Allows the TokenVault owner to send tokens out of the vault.

    @param _recipients The array of addresses to receive tokens.
    @param _assets The struct array that stores information about tokens that should bew sended
  */
  function sendTokens(address[] calldata _recipients,address[] calldata _tokens, Asset[] calldata _assets) external nonReentrant onlyOwner {
    require(_recipients.length > 0,
      "You must send tokens to at least one recipient.");
    require(_recipients.length == _assets.length,
      "Recipients length cannot be mismatched with assets length.");
    
    // Iterate through every specified recipient and send tokens.
    uint256 totalAmount = 0;
    uint256 totalEth = 0;
    uint256 totalSuper721 = 0;
    uint256 totalSuper1155 = 0;
    for (uint256 i = 0; i < _recipients.length; i++) {
        address recipient = _recipients[i];
        address tokenAddr = _tokens[i];
        Asset memory asset = _assets[i];
        uint256 amount = asset.amounts[0];


        if (asset.assetType == AssetType.Eth) {
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "send Eth failed");
            totalEth += amount;
        }
        if (asset.assetType == AssetType.ERC20) {
            IERC20(token).safeTransfer(recipient, amount);
            totalAmount = totalAmount + amount;
        }
        if (asset.assetType == AssetType.ERC721) {
          require(super721Addresses.contains(tokenAddr), "Super721 address is not availible");
          ISuper721(tokenAddr).safeBatchTransferFrom(address(this), recipient, asset.ids, "");
          totalSuper721 += 1; // TO_ASK calculate number of transfers, or may be change it to number of ids? 
        }
        if (asset.assetType == AssetType.ERC1155) {
          require(super1155Addresses.contains(tokenAddr), "Super1155 address is not availible");
          ISuper1155(tokenAddr).safeBatchTransferFrom(address(this), recipient, asset.ids, asset.amounts, "");
          totalSuper1155 += 1;
        }
        _removeToken(tokenAddr, asset);
    }
    emit TokenSend(totalAmount, totalEth, totalSuper721, totalSuper1155); 
  }

  function _removeToken(address _token, Asset memory _asset) internal {
    if (_asset.assetType == AssetType.ERC721) {
      super721Addresses.remove(_token);
    } 
    if (_asset.assetType == AssetType.ERC1155) {
      super1155Addresses.remove(_token);
    }
    // TO_ASK we need to remove info about asset in map, think not 
  }

  /**
    Allow the TokenVault's `panicOwner` to immediately send its contents to a
    predefined `panicDestination`. This can be used to circumvent the timelock
    in case of an emergency.
  */
  function panic() external nonReentrant onlyPanicOwner {
    uint256 totalBalanceERC20 = IERC20(token).balanceOf(address(this));
    uint256 totalBalanceEth = address(this).balance;
    uint256 totalAmountERC721 = super721Addresses.length();
    uint256 totalAmountERC1155 = super1155Addresses.length();
    // TODO add support for ERC721 and ERC1155

    // If the panic limit is reached, burn the tokens.
    if (panicCounter == panicLimit || panicDestination == address(0)) {
        // burn eth
        ERC20Burnable(token).burn(totalBalanceERC20); // CHECK
        (bool success, ) = address(0).call{value: totalBalanceEth}("");
        require(success, "Ether burn was unsuccessful");

        for (uint256 i = 0; i < super721Addresses.length(); i++) {
           ISuper721(super721Addresses.at(i)).burnBatch(
             address(this),
             assets[super721Addresses.at(i)].ids
           );
        }
        for (uint256 i = 0; i < super1155Addresses.length(); i++) {
          ISuper1155(super1155Addresses.at(i)).burnBatch(
            address(this), 
            assets[super1155Addresses.at(i)].ids, 
            assets[super1155Addresses.at(i)].amounts
          );
        }
        emit PanicBurn(panicCounter, totalBalanceERC20, totalBalanceEth, totalAmountERC721, totalAmountERC1155);
    } else {
        IERC20(token).safeTransfer(panicDestination, totalBalanceERC20);
        (bool success, ) = panicDestination.call{value: totalBalanceEth}("");
        require(success, "Ether transfer was unsuccessful");
        for (uint256 i = 0; i < super721Addresses.length(); i++) {
          ISuper721(super721Addresses.at(i)).safeBatchTransferFrom(address(this), panicDestination, assets[super721Addresses.at(i)].ids, "");
        }
        for (uint256 i = 0; i < super1155Addresses.length(); i++) {
          ISuper1155(super721Addresses.at(i)).safeBatchTransferFrom(address(this), panicDestination, assets[super1155Addresses.at(i)].ids, assets[super1155Addresses.at(i)].amounts, "");
        }
        panicCounter = panicCounter + 1;
        emit PanicTransfer(panicCounter, totalBalanceERC20, totalBalanceEth, totalAmountERC721, totalAmountERC1155, panicDestination);
      }
  }

  receive() external payable {
    emit Receive(msg.sender, msg.value);
  }

  function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
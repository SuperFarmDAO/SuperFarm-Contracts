// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;


import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ISuper1155.sol"; // CHECK not that interface
import "./interfaces/ISuper721.sol";
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
contract TokenVault is Ownable, ReentrancyGuard {
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
    mapping(address => uint256[]) tokenIds; 

    enum AssetType {
        Eth,
        ERC20,
        ERC1155,
        ERC721
    }

    /**
    */ 
    struct Asset { 
        AssetType assetType;
        address token;
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
  event TokenSend(uint256 tokenAmount, uint256 etherAmount);

  /// An event for tracking a panic transfer of tokens.
  event PanicTransfer(uint256 panicCounter, uint256 tokenAmount, uint256 etherAmount, address indexed destination);

  /// An event for tracking a panic burn of tokens.
  event PanicBurn(uint256 panicCounter, uint256 tokenAmount, uint256 etherAmount);

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
     */
    function addSuper721Addr(address _super721) external nonReentrant onlyOwner {
        // TO_ASK possibility to add multiple address is needed ? 
        require(!super721Addresses.contains(_super721), "value already presented in set");
        super721Addresses.add(_super721);
    }
    
    /**
        add Super1155 contract addresses to the set of addreses
     */
    function addSuper1155Addr(address _super1155) external nonReentrant onlyOwner {
        // TO_ASK possibility to add multiple address is needed ? 
        require(!super1155Addresses.contains(_super1155), "value already presented in set");
        super1155Addresses.add(_super1155);
    }

    /** function for adding token ids for specific 
     */
    function addTokens(address[] calldata _contrAddrs, uint256[] calldata _ids) external nonReentrant onlyOwner {
      require(_contrAddrs.length == _ids.length, "Number of contracts and id should be the same");

      for (uint256 i = 0; i < _contrAddrs.length; i++) {
        require(super1155Addresses.contains(_contrAddrs[i]) || super721Addresses.contains(_contrAddrs[i]), "Address of token is not permited"); 
        tokenIds[_contrAddrs[i]].push(_ids[i]);
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
    @param _amounts The array of amounts sent to each address in `_recipients`.
  */
  function sendTokens(address[] calldata _recipients, uint256[] calldata _amounts, Asset[] calldata _assets) external nonReentrant onlyOwner {
    // CHECK that amounts are unused
    require(_recipients.length > 0,
      "You must send tokens to at least one recipient.");
    require(_recipients.length == _amounts.length,
      "Recipients length cannot be mismatched with amounts length.");
    require(_assets.length == _amounts.length, 
      "Assets lenght cannot be mismatched with amounts length.");

    // Iterate through every specified recipient and send tokens.
    uint256 totalAmount = 0;
    uint256 totalEth = 0;
    for (uint256 i = 0; i < _recipients.length; i++) {
        address recipient = _recipients[i];
        Asset memory asset = _assets[i];
        uint256 amount = asset.amounts[0];

        if (asset.assetType == AssetType.Eth) {
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "send Eth failed");
        }
        if (asset.assetType == AssetType.ERC20) {
            IERC20(token).safeTransfer(recipient, amount);
            totalAmount = totalAmount + amount;
        }
        if (asset.assetType == AssetType.ERC721) {
          require(super721Addresses.contains(asset.token), "Super721 address is not availible");
          ISuper721(asset.token).safeBatchTransferFrom(address(this), recipient, asset.ids, _data);     // 
        }
        if (asset.assetType == AssetType.ERC1155) {
          require(super1155Addresses.contains(asset.token), "Super1155 address is not availible");
          ISuper1155(asset.token).safeBatchTransferFrom(address(this), recipient, asset.ids, asset.amounts, _data); // TODO 
        }
    }
    emit TokenSend(totalAmount, totalEth); // TODO emit info about ERC721, ERC1155
  }

  /**
    Allow the TokenVault's `panicOwner` to immediately send its contents to a
    predefined `panicDestination`. This can be used to circumvent the timelock
    in case of an emergency.
  */
  function panic() external nonReentrant onlyPanicOwner {
    uint256 totalBalanceERC20 = IERC20(token).balanceOf(address(this));
    uint256 totalBalanceEth = address(this).balance;
    // TODO add support for ERC721 and ERC1155

    // If the panic limit is reached, burn the tokens.
    if (panicCounter == panicLimit) {
        // burn eth
        Token(token).burn(totalBalanceERC20); // CHECK

        emit PanicBurn(panicCounter, totalBalanceERC20, totalBalanceEth);

    // Otherwise, drain the vault to the panic destination.
    } else {
      if (panicDestination == address(0)) {
        Token(token).burn(totalBalanceERC20);
        emit PanicBurn(panicCounter, totalBalanceERC20, totalBalanceEth);
      } else {
        IERC20(token).safeTransfer(panicDestination, totalBalanceERC20);
        emit PanicTransfer(panicCounter, totalBalanceERC20, totalBalanceEth, panicDestination);
      }
      panicCounter = panicCounter + 1;
    }
  }

    /** 
     */
    receive() external payable {
        emit Receive(msg.sender, msg.value);
    }
}
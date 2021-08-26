// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./ISuper1155.sol";
import "./access/PermitControl.sol";

/**
  @title A public notary contract where asset holders may publish a message tied
    to their proof of ownership.
  @author Tim Clancy

  This contract allows the owners of specific assets to publish public messages
  tied to the ownership of said asset. This is useful, for instance, as a tool
  to allow holders of specific token IDs within a `Super1155` collection to
  formally approve some action that may be taken against the token.

  August 12th, 2021.
*/
contract Notary is PermitControl {
  using Address for address;
  using SafeMath for uint256;

  /// The `Super1155` collection to check asset ownership against.
  ISuper1155 public collection;

  /**
    This enumeration tracks the three states that the signature for any given
    token ID may be in.

    @param Invalid The token ID is not a valid token in `collection` to attempt
      signatures against.
    @param Permitted The token ID owner is permitted to sign against this token
      ID.
    @param Signed The token ID has been signed for by an owner.
  */
  enum SignatureStatus {
    Invalid,
    Permitted,
    Signed
  }

  /// A mapping from each token ID to its `SignatureStatus`.
  mapping (uint256 => SignatureStatus) public signatureStatus;

  /// A mapping from caller to each token ID signed by that caller.
  mapping (address => mapping (uint256 => bool)) public signed;

  /**
    An event emitted when caller `caller` signs for `ids` in `collection`.

    @param caller The caller notarizing based on ownership.
    @param collection The `Super1155` collection being notarized for.
    @param ids The token IDs within `collection` that are notarized.
  */
  event Notarize(address indexed caller, address indexed collection,
    uint256[] ids);

  /**
    Construct a new Notary by providing a `Super1155` `_collection` to check
    asset ownership against and a `_tokenIds` array to configure as eligible
    signing assets.

    @param _collection The address for the `Super1155` contract to check asset
      ownership against.
    @param _tokenIds The array of token IDs that are eligible signing items.
  */
  constructor (ISuper1155 _collection, uint256[] memory _tokenIds) {
    collection = _collection;
    for (uint256 i = 0; i < _tokenIds.length; i++) {
      signatureStatus[ _tokenIds[i] ] = SignatureStatus.Permitted;
    }
  }

  /**
    Allow the caller to, following verification of asset ownership, sign for
    each of the token IDs in `_ids`.

    @param _ids The array of token IDs that the caller is signing for.
  */
  function sign (uint256[] calldata _ids) external {
    require(_ids.length > 0,
      "Notary::sign::Must sign for at least one ID");
    for (uint256 i = 0; i < _ids.length; i++) {
      require(signatureStatus[ _ids[i] ] != SignatureStatus.Invalid,
        "Notary::sign::Invalid token ID");
      require(signatureStatus[ _ids[i] ] == SignatureStatus.Permitted,
        "Notary::sign::Token ID already signed for");
      signatureStatus[ _ids[i] ] = SignatureStatus.Signed;
      signed[_msgSender()][ _ids[i] ] = true;
    }
    emit Notarize(_msgSender(), address(collection), _ids);
  }
}

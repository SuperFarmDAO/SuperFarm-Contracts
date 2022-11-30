// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;

interface ISuper1155 {
  function BURN (  ) external view returns ( bytes32 );
  function CONFIGURE_GROUP (  ) external view returns ( bytes32 );
  function LOCK_CREATION (  ) external view returns ( bytes32 );
  function LOCK_ITEM_URI (  ) external view returns ( bytes32 );
  function LOCK_URI (  ) external view returns ( bytes32 );
  function MANAGER (  ) external view returns ( bytes32 );
  function MINT (  ) external view returns ( bytes32 );
  function SET_METADATA (  ) external view returns ( bytes32 );
  function SET_PROXY_REGISTRY (  ) external view returns ( bytes32 );
  function SET_URI (  ) external view returns ( bytes32 );
  function UNIVERSAL (  ) external view returns ( bytes32 );
  function ZERO_RIGHT (  ) external view returns ( bytes32 );

  function balanceOf ( address _owner, uint256 _id ) external view returns ( uint256 );
  function balanceOfBatch ( address[] memory _owners, uint256[] memory _ids ) external view returns ( uint256[] memory );
  function burn ( address _burner, uint256 _id, uint256 _amount ) external;
  function burnBatch ( address _burner, uint256[] memory _ids, uint256[] memory _amounts ) external;
  function burnCount ( uint256 ) external view returns ( uint256 );
  function circulatingSupply ( uint256 ) external view returns ( uint256 );
  function configureGroup ( uint256 _groupId, bytes calldata _data ) external;
  function groupBalances ( uint256, address ) external view returns ( uint256 );
  function groupMintCount ( uint256 ) external view returns ( uint256 );
  function hasRightUntil ( address _address, bytes32 _circumstance, bytes32 _right ) external view returns ( uint256 );
  function isApprovedForAll ( address _owner, address _operator ) external view returns ( bool );
  function itemGroups ( uint256 ) external view returns ( bool initialized, string memory _name, uint8 supplyType, uint256 supplyData, uint8 itemType, uint256 itemData, uint8 burnType, uint256 burnData, uint256 _circulatingSupply, uint256 _mintCount, uint256 _burnCount );
  function lock (  ) external;
  function lockURI ( string memory _uri, uint256 _id ) external;
  function lockURI ( string memory _uri ) external;
  function locked (  ) external view returns ( bool );
  function managerRight ( bytes32 ) external view returns ( bytes32 );
  function metadata ( uint256 ) external view returns ( string memory );
  function metadataFrozen ( uint256 ) external view returns ( bool );
  function metadataUri (  ) external view returns ( string memory );
  function mintBatch ( address _recipient, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data ) external;
  function mintCount ( uint256 ) external view returns ( uint256 );
  function name (  ) external view returns ( string memory );
  function owner (  ) external view returns ( address );
  function permissions ( address, bytes32, bytes32 ) external view returns ( uint256 );
  function proxyRegistryAddress (  ) external view returns ( address );
  function renounceOwnership (  ) external;
  function safeBatchTransferFrom ( address _from, address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data ) external;
  function safeTransferFrom ( address _from, address _to, uint256 _id, uint256 _amount, bytes memory _data ) external;
  function setApprovalForAll ( address _operator, bool _approved ) external;
  function setManagerRight ( bytes32 _managedRight, bytes32 _managerRight ) external;
  function setMetadata ( uint256 _id, string memory _metadata ) external;
  function setPermit ( address _address, bytes32 _circumstance, bytes32 _right, uint256 _expirationTime ) external;
  function setProxyRegistry ( address _proxyRegistryAddress ) external;
  function setURI ( string memory _uri ) external;
  function supportsInterface ( bytes4 interfaceId ) external view returns ( bool );
  function totalBalances ( address ) external view returns ( uint256 );
  function transferOwnership ( address newOwner ) external;
  function uri ( uint256 ) external view returns ( string memory );
  function uriLocked (  ) external view returns ( bool );
  function version (  ) external view returns ( uint256 );
}

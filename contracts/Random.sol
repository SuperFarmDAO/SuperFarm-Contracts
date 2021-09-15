// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./base/Named.sol";
import "./base/Sweepable.sol";

/**
  @title A contract to retrieve secure on-chain randomness from Chainlink.
  @author Tim Clancy

  This contract is a portal for on-chain random data. It allows any caller to
  pay the appropriate amount of LINK and retrieve a source of secure randomness
  from Chainlink. The contract supports both the direct retrieval of Chainlink's
  trusted randomness and helper functions to retrieve random values within a
  specific range.

  July 26th, 2021.
*/
contract Random is Named, Sweepable, VRFConsumerBase {
  using SafeERC20 for IERC20;

  /// The public identifier for the right to adjust the Chainlink connection.
  bytes32 public constant SET_CHAINLINK = keccak256("SET_CHAINLINK");

  /**
    This struct defines the parameters needed to communicate with a Chainlink
    VRF coordinator.

    @param coordinator The address of the Chainlink VRF coordinator.
    @param link The address of Chainlink's LINK token.
    @param keyHash The key hash of the Chainlink VRF coordinator.
    @param fee The fee in LINK required to utilize Chainlink's VRF service.
  */
  struct Chainlink {
    address coordinator;
    address link;
    bytes32 keyHash;
    uint256 fee;
  }

  /// The current data governing this portal's connection to Chainlink's VRF.
  Chainlink public chainlink;

  /**
    This struct defines the response that Chainlink returns to us for a given
    call out to `requestRandomness`.

    @param requester The caller who requested this Chainlink response.
    @param requestId The ID of the request to the Chainlink VRF coordinator.
    @param pending Whether or not the request to Chainlink is still pending.
    @param result The resulting value of secure randomness returned by
      Chainlink.
  */
  struct ChainlinkResponse {
    address requester;
    bytes32 requestId;
    bool pending;
    uint256 result;
  }

  /// A mapping from caller-specified randomness IDs to Chainlink responses.
  mapping (bytes32 => ChainlinkResponse) public chainlinkResponses;

  /// A reverse mapping from Chainlink request IDs to caller-specified IDs.
  mapping (bytes32 => bytes32) public callerIds;

  /**
    A mapping from caller addresses to the number of Chainlink VRF secure
    randomness responses that the caller has requested. This is used to index
    into the `callerRequests` mapping.
  */
  mapping (address => uint256) public callerRequestCounts;

  /// A mapping from callers to the Chainlink response data they've asked for.
  mapping (address => mapping (uint256 => ChainlinkResponse))
    public callerRequests;

  /**
    An event emitted when the Chainlink connection  of this contract is updated.

    @param updater The address which updated the Chainlink connection.
    @param oldChainlink The old Chainlink details.
    @param newChainlink The new Chainlink details.
  */
  event ChainlinkUpdated(address indexed updater,
    Chainlink indexed oldChainlink, Chainlink indexed newChainlink);

  /**
    An event emitted when a caller requests secure randomness from Chainlink.

    @param requester The caller requesting the secure randomness.
    @param id The caller-specified ID for the randomness.
    @param chainlinkRequestId The Chainlink-generated request ID.
  */
  event RequestCreated(address indexed requester, bytes32 indexed id,
    bytes32 indexed chainlinkRequestId);

  /**
    An event emitted when Chainlink fulfills a request for randomness.

    @param chainlinkRequestId The request ID being fulfilled by Chainlink.
    @param result The resulting secure randomness.
  */
  event RequestFulfilled(bytes32 indexed chainlinkRequestId,
    uint256 indexed result);

  /**
    Construct a new portal to retrieve randomness from Chainlink.

    @param _owner The address of the administrator governing this portal.
    @param _name The name to assign to this random portal.
    @param _chainlink The Chainlink data to use for connecting to a VRF
      coordinator.
  */
  constructor(address _owner, string memory _name,
    Chainlink memory _chainlink) Named(_name)
    VRFConsumerBase(_chainlink.coordinator, _chainlink.link) {

    // Do not perform a redundant ownership transfer if the deployer should
    // remain as the owner of the collection.
    if (_owner != owner()) {
      transferOwnership(_owner);
    }

    // Continue initialization.
    chainlink = _chainlink;
  }

  /**
    Return a version number for this contract's interface.
  */
  function version() external virtual override(Named, Sweepable) pure returns
    (uint256) {
    return 1;
  }

  /**
    Allow those with permission to set Chainlink VRF connection details.

    @param _chainlink The new Chainlink data to use for connecting to a VRF
      coordinator.
  */
  function setChainlink(Chainlink calldata _chainlink) external
    hasValidPermit(UNIVERSAL, SET_CHAINLINK) {
    Chainlink memory oldChainlink = chainlink;
    chainlink = _chainlink;
    emit ChainlinkUpdated(_msgSender(), oldChainlink, _chainlink);
  }

  /**
    Create and store a source of secure randomness from Chainlink. The caller
    pays the LINK fee required to utilize Chainlink's VRF coordinator.

    Chainlink warns us that it is important to avoid calling `requestRandomness`
    repeatedly if the response from the VRF coordinator is delayed. Doing so
    would leak data to VRF operators about the potential ordering of VRF calls.

    @param _id A unique ID to assign to the requested randomness.
    @return The randomness request ID generated by Chainlink's VRF coordinator.
  */
  function random(bytes32 _id) external returns (bytes32) {
    require(chainlinkResponses[_id].requester == address(0),
      "Random: randomness has already been generated for the specified ID");

    // Attempt to transfer enough LINK from the caller to cover Chainlink's fee.
    IERC20 link = IERC20(chainlink.link);
    require(link.balanceOf(_msgSender()) >= chainlink.fee,
      "Random: you do not have enough LINK to request randomness");
    link.safeTransferFrom(_msgSender(), address(this), chainlink.fee);

    // Request the secure source of randomness from Chainlink.
    bytes32 chainlinkRequestId = requestRandomness(chainlink.keyHash,
      chainlink.fee);

    // Update all storage mappings with the pending Chainlink response.
    ChainlinkResponse memory chainlinkResponse = ChainlinkResponse({
      requester: _msgSender(),
      requestId: chainlinkRequestId,
      pending: true,
      result: 0
    });
    chainlinkResponses[_id] = chainlinkResponse;
    callerIds[chainlinkRequestId] = _id;
    uint256 responseIndex = callerRequestCounts[_msgSender()];
    callerRequests[_msgSender()][responseIndex] = chainlinkResponse;
    callerRequestCounts[_msgSender()] = responseIndex + 1;

    // Emit an event denoting the request to Chainlink.
    emit RequestCreated(_msgSender(), _id, chainlinkRequestId);
    return chainlinkRequestId;
  }

  /**
    This is a callback function used by Chainlink's VRF coordinator to return
    the source of randomness to this contract.

    Chainlink warns us that we should not have multiple VRF requests in flight
    at once if their order would result in different contract states. Otherwise,
    Chainlink VRF coordinators could manipulate our contract by controlling the
    order in which randomness returns.

    @param _requestId The ID of the randomness request which is being answered
      by Chainlink's VRF coordinator.
    @param _randomness The resulting randomness.
  */
  function fulfillRandomness(bytes32 _requestId, uint256 _randomness) internal
    override {
    bytes32 callerId = callerIds[_requestId];
    chainlinkResponses[callerId].pending = false;
    chainlinkResponses[callerId].result = _randomness;
    emit RequestFulfilled(_requestId, _randomness);
  }

  /**
    Interpret the randomness response from Chainlink as an integer within some
    range from `_origin` (inclusive) to `_bound` (exclusive). For example, the
    results of rolling 1d20 would be specified as `asRange(..., 1, 21)`.

    @param _source The caller-specified ID for a source of Chainlink randomness.
    @param _origin The first value to include in the range.
    @param _bound The end of the range; this value is excluded from the range.
  */
  function asRange(bytes32 _source, uint256 _origin, uint256 _bound) external
    view returns (uint256) {
    require (_bound > _origin,
      "Random: there must be at least one possible value in range");
    require(chainlinkResponses[_source].requester != address(0)
      && !chainlinkResponses[_source].pending,
      "Random: you may only interpret the results of a fulfilled request");

    // Return the interpreted result.
    return (chainlinkResponses[_source].result % (_bound - _origin)) + _origin;
  }
}
/**
  @title An authenticated proxy contract.
  @author Protinam, Project Wyvern
  @author Tim Clancy

  This contract was originally developed as a
*/
contract AuthenticatedProxy is TokenRecipient, OwnedUpgradeabilityStorage {

    /// Whether or not this proxy is initialized.
    bool public initialized = false;

    /// The address which owns this proxy.
    address public user;

    /// The associated `ProxyRegistry` contract with authentication information.
    ProxyRegistry public registry;

    /// Whether or not access has been revoked.
    bool public revoked;

    /**
      An enumerable type for selecting the method by which we would like to
      perform a call in the `proxy` function.

      @param Call This call type specifies that we perform a direct call.
      @param DelegateCall This call type can be used to automatically transfer
        multiple assets owned by the proxy contract with one order.
    */
    enum CallType {
      Call,
      DelegateCall
    }

    /**
      An event fired when the proxy contract's access is revoked or unrevoked.

      @param revoked The status of the revocation call; true if access is
        revoked and false if access is unrevoked.
    */
    event Revoked(bool revoked);

    /**
     * Initialize an AuthenticatedProxy
     *
     * @param addrUser Address of user on whose behalf this proxy will act
     * @param addrRegistry Address of ProxyRegistry contract which will manage this proxy
     */
    function initialize (address addrUser, ProxyRegistry addrRegistry)
        public
    {
        require(!initialized);
        initialized = true;
        user = addrUser;
        registry = addrRegistry;
    }

    /**
     * Set the revoked flag (allows a user to revoke ProxyRegistry access)
     *
     * @dev Can be called by the user only
     * @param revoke Whether or not to revoke access
     */
    function setRevoke(bool revoke)
        public
    {
        require(msg.sender == user);
        revoked = revoke;
        emit Revoked(revoke);
    }

    /**
     * Execute a message call from the proxy contract
     *
     * @dev Can be called by the user, or by a contract authorized by the registry as long as the user has not revoked access
     * @param dest Address to which the call will be sent
     * @param howToCall Which kind of call to make
     * @param calldata Calldata to send
     * @return Result of the call (success or failure)
     */
    function proxy(address dest, HowToCall howToCall, bytes _calldata)
        public
        returns (bool result)
    {
        require(msg.sender == user || (!revoked && registry.contracts(msg.sender)));
        if (howToCall == HowToCall.Call) {
            result = dest.call(_calldata);
        } else if (howToCall == HowToCall.DelegateCall) {
            result = dest.delegatecall(_calldata);
        }
        return result;
    }

    /**
     * Execute a message call and assert success
     *
     * @dev Same functionality as `proxy`, just asserts the return value
     * @param dest Address to which the call will be sent
     * @param howToCall What kind of call to make
     * @param calldata Calldata to send
     */
    function proxyAssert(address dest, HowToCall howToCall, bytes _calldata)
        public
    {
        require(proxy(dest, howToCall, _calldata));
    }

}

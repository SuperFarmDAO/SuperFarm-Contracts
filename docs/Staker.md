## `Staker`






### `constructor(string _name, contract IERC20 _token)` (public)

Construct a new Staker by providing it a name and the token to disburse.
    @param _name The name of the Staker contract.
    @param _token The token to reward stakers in this contract with.



### `addDeveloper(address _developerAddress, uint256 _share)` (external)

Add a new developer to the Staker or overwrite an existing one.
    This operation requires that developer address addition is not locked.
    @param _developerAddress The additional developer's address.
    @param _share The share in 1/1000th of a percent of each token emission sent
    to this new developer.



### `lockDevelopers()` (external)

Permanently forfeits owner ability to alter the state of Staker developers.
    Once called, this function is intended to give peace of mind to the Staker's
    developers and community that the fee structure is now immutable.



### `updateDeveloper(address _newDeveloperAddress, uint256 _newShare)` (external)

A developer may at any time update their address or voluntarily reduce their
    share of emissions by calling this function from their current address.
    Note that updating a developer's share to zero effectively removes them.
    @param _newDeveloperAddress An address to update this developer's address.
    @param _newShare The new share in 1/1000th of a percent of each token
    emission sent to this developer.



### `setEmissions(struct Staker.EmissionPoint[] _tokenSchedule, struct Staker.EmissionPoint[] _pointSchedule)` (external)

Set new emission details to the Staker or overwrite existing ones.
    This operation requires that emission schedule alteration is not locked.

    @param _tokenSchedule An array of EmissionPoints defining the token schedule.
    @param _pointSchedule An array of EmissionPoints defining the point schedule.



### `lockTokenEmissions()` (external)

Permanently forfeits owner ability to alter the emission schedule.
    Once called, this function is intended to give peace of mind to the Staker's
    developers and community that the inflation rate is now immutable.



### `lockPointEmissions()` (external)

Permanently forfeits owner ability to alter the emission schedule.
    Once called, this function is intended to give peace of mind to the Staker's
    developers and community that the inflation rate is now immutable.



### `getDeveloperCount() → uint256` (external)

Returns the length of the developer address array.
    @return the length of the developer address array.



### `getPoolCount() → uint256` (external)

Returns the length of the staking pool array.
    @return the length of the staking pool array.



### `getRemainingToken() → uint256` (external)

Returns the amount of token that has not been disbursed by the Staker yet.
    @return the amount of token that has not been disbursed by the Staker yet.



### `addPool(contract IERC20 _token, uint256 _tokenStrength, uint256 _pointStrength)` (external)

Allows the contract owner to add a new asset pool to the Staker or overwrite
    an existing one.
    @param _token The address of the asset to base this staking pool off of.
    @param _tokenStrength The relative strength of the new asset for earning token.
    @param _pointStrength The relative strength of the new asset for earning points.



### `getTotalEmittedTokens(uint256 _fromBlock, uint256 _toBlock) → uint256` (public)

Uses the emission schedule to calculate the total amount of staking reward
    token that was emitted between two specified block numbers.

    @param _fromBlock The block to begin calculating emissions from.
    @param _toBlock The block to calculate total emissions up to.



### `getTotalEmittedPoints(uint256 _fromBlock, uint256 _toBlock) → uint256` (public)

Uses the emission schedule to calculate the total amount of points
    emitted between two specified block numbers.

    @param _fromBlock The block to begin calculating emissions from.
    @param _toBlock The block to calculate total emissions up to.



### `updatePool(contract IERC20 _token)` (internal)

Update the pool corresponding to the specified token address.
    @param _token The address of the asset to update the corresponding pool for.



### `getPendingTokens(contract IERC20 _token, address _user) → uint256` (public)

A function to easily see the amount of token rewards pending for a user on a
    given pool. Returns the pending reward token amount.
    @param _token The address of a particular staking pool asset to check for a
    pending reward.
    @param _user The user address to check for a pending reward.
    @return the pending reward token amount.



### `getPendingPoints(contract IERC20 _token, address _user) → uint256` (public)

A function to easily see the amount of point rewards pending for a user on a
    given pool. Returns the pending reward point amount.

    @param _token The address of a particular staking pool asset to check for a
    pending reward.
    @param _user The user address to check for a pending reward.
    @return the pending reward token amount.



### `getAvailablePoints(address _user) → uint256` (public)

Return the number of points that the user has available to spend.
    @return the number of points that the user has available to spend.



### `getTotalPoints(address _user) → uint256` (external)

Return the total number of points that the user has ever accrued.
    @return the total number of points that the user has ever accrued.



### `getSpentPoints(address _user) → uint256` (external)

Return the total number of points that the user has ever spent.
    @return the total number of points that the user has ever spent.



### `deposit(contract IERC20 _token, uint256 _amount)` (external)

Deposit some particular assets to a particular pool on the Staker.
    @param _token The asset to stake into its corresponding pool.
    @param _amount The amount of the provided asset to stake.



### `withdraw(contract IERC20 _token, uint256 _amount)` (external)

Withdraw some particular assets from a particular pool on the Staker.
    @param _token The asset to withdraw from its corresponding staking pool.
    @param _amount The amount of the provided asset to withdraw.



### `approvePointSpender(address _spender, bool _approval)` (external)

Allows the owner of this Staker to grant or remove approval to an external
    spender of the points that users accrue from staking resources.
    @param _spender The external address allowed to spend user points.
    @param _approval The updated user approval status.



### `spendPoints(address _user, uint256 _amount)` (external)

Allows an approved spender of points to spend points on behalf of a user.
    @param _user The user whose points are being spent.
    @param _amount The amount of the user's points being spent.




### `Deposit(address user, contract IERC20 token, uint256 amount)`





### `Withdraw(address user, contract IERC20 token, uint256 amount)`





### `SpentPoints(address source, address user, uint256 amount)`






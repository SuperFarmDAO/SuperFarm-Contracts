## `FarmStakerRecords`






### `createFarm(string _name, contract IERC20 _token, struct Staker.EmissionPoint[] _tokenSchedule, struct Staker.EmissionPoint[] _pointSchedule, struct FarmStakerRecords.PoolData[] _initialPools) → contract Staker` (external)

Create a Staker on behalf of the owner calling this function. The Staker
    supports immediate specification of the emission schedule and pool strength.

    @param _name The name of the Staker to create.
    @param _token The Token to reward stakers in the Staker with.
    @param _tokenSchedule An array of EmissionPoints defining the token schedule.
    @param _pointSchedule An array of EmissionPoints defining the point schedule.
    @param _initialPools An array of pools to initially add to the new Staker.



### `addFarm(address _farmAddress)` (external)

Allow a user to add an existing Staker contract to the registry.

    @param _farmAddress The address of the Staker contract to add for this user.



### `getFarmCount(address _user) → uint256` (external)

Get the number of entries in the Staker records mapping for the given user.

    @return The number of Stakers added for a given address.




### `FarmCreated(address farmAddress, address creator)`

An event for tracking the creation of a new Staker.




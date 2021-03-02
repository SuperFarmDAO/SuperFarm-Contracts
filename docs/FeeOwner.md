## `FeeOwner`






### `constructor(uint256 _fee, uint256 _maximumFee)` (public)

Construct a new FeeOwner by providing specifying a fee.

    @param _fee The percent fee to apply, represented as 1/1000th of a percent.
    @param _maximumFee The maximum possible fee that the owner can set.



### `changeFee(uint256 newFee)` (external)

Allows the owner of this fee to modify what they take, within bounds.

    @param newFee The new fee to begin using.




### `FeeChanged(uint256 oldFee, uint256 newFee)`

An event for tracking modification of the fee.




let abiBuyPunk = ["function buyPunk(uint punkIndex)"];
let abiTransferPunk = ["function transferPunk(address to, uint punkIndex)"];
let abiOfferPunkForSaleToAddress = ["function offerPunkForSaleToAddress(uint punkIndex, uint minSalePriceInWei, address toAddress)"];

let replacementPatternBuyPunk = "";
let replacementPatternTransferPunk = "0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000000";
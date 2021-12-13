export const types = {
    Outline: [
        {
            name: "basePrice",
            type: "uint256"
        },
        {
            name: "listingTime",
            type: "uint256"
        },
        {
            name: "expirationTime",
            type: "uint256"
        },
        {
            name: "exchange",
            type: "address"
        },
        {
            name: "maker",
            type: "address"
        },
        {
            name: "side",
            type: "uint8"
        },
        {
            name: "taker",
            type: "address"
        },
        {
            name: "saleKind",
            type: "uint8"
        },
        {
            name: "target",
            type: "address"
        },
        {
            name: "callType",
            type: "uint8"
        },
        {
            name: "paymentToken",
            type: "address"
        },
    ],
    Order: [
        // {
        //     name: "outline",
        //     type: "Outline"
        // },
        {
            name: "extra",
            type: "uint256[]"
        },
        {
            name: "salt",
            type: "uint256"
        }, {
            name: "fees",
            type: "uint256"
        }, {
            name: "addresses",
            type: "address[]"
        }, {
            name: "staticTarget",
            type: "address"
        }, {
            name: "data",
            type: "bytes"
        }, {
            name: "replacementPattern",
            type: "bytes"
        }, {
            name: "staticExtradata",
            type: "bytes"
        }
    ]
}


export const OrderType = {
    Order: [
        {
            name: "outline",
            type: "Outline"
        },
        {
            name: "extra",
            type: "uint256[]"
        },
        {
            name: "salt",
            type: "uint256"
        },
        {
            name: "fees",
            type: "uint256[]"
        },
        {
            name: "addresses",
            type: "address[]"
        },
        {
            name: "staticTarget",
            type: "address"
        },
        {
            name: "data",
            type: "bytes"
        },
        {
            name: "replacementPattern",
            type: "bytes"
        },
        {
            name: "staticExtradata",
            type: "bytes"
        }
    ],
    Outline: [
        {
            name: "basePrice",
            type: "uint256"
        },
        {
            name: "listingTime",
            type: "uint256"
        },
        {
            name: "expirationTime",
            type: "uint256"
        },
        {
            name: "exchange",
            type: "address"
        },
        {
            name: "maker",
            type: "address"
        },
        {
            name: "side",
            type: "uint8"
        },
        {
            name: "taker",
            type: "address"
        },
        {
            name: "saleKind",
            type: "uint8"
        },
        {
            name: "target",
            type: "address"
        },
        {
            name: "callType",
            type: "uint8"
        },
        {
            name: "paymentToken",
            type: "address"
        },
    ]
}
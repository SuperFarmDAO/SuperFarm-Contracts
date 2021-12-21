export const types = {
    Order: [
        {
            name: "conditions",
            type: "Conditions"
        },
        // {
        //     name: "exchange",
        //     type: "address"
        // },
        // {
        //     name: "side",
        //     type: "uint8"
        // },
        // {
        //     name: "callType",
        //     type: "uint8"
        // },
        // {
        //     name: "salt",
        //     type: "uint256"
        // },
        // {
        //     name: "fees",
        //     type: "uint256[]"
        // },
        // {
        //     name: "feeReceivers",
        //     type: "address[]"
        // }
    ],
    Conditions: [
        {
            name: "give",
            type: "Assets"
        },
        {
            name: "take",
            type: "Assets"
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
            name: "maker",
            type: "address"
        },
        {
            name: "taker",
            type: "address"
        },
        {
            name: "saleKind",
            type: "uint8"
        }
    ],
    Assets:[
        {
            name: "assetsType",
            type: "uint8"
        },{
            name: "target",
            type: "address"
        },{
            name: "staticTarget",
            type: "address"
        },{
            name: "data",
            type: "bytes"
        },{
            name: "replacementPattern",
            type: "bytes"
        },{
            name: "staticExtradata",
            type: "bytes"
        }
    ]
}
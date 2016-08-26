"use strict";

var OneBuf = require("../OneBuf.js");

var schema = {
    id: "user",
    fields: [{
        name: "sn",
        type: "uint16",
    }, {
        name: "name",
        type: "string",
    }, {
        name: "gender",
        type: "uint8",
    }, {
        name: "age",
        type: "uint8",
    }, {
        name: "height",
        type: "float32",
    }, {
        name: "weight",
        type: "float32",
    }]
};

var userData = {
    sn: 1234,
    name: "Tom",
    gender: 1,
    age: 32,
    height: 177.40,
    weight: 87.50,
};

doTest(userData, schema);



function doTest(data, schema, schemaPool) {
    if (schemaPool) {
        for (var i = 0; i < schemaPool.length; i++) {
            OneBuf.loadSchema(schemaPool[i]);
        }
    }
    var struct = OneBuf.loadSchema(schema);
    var encodedData = struct.jsonToBinary(data);
    var decodedData = struct.binaryToJSON(encodedData);
    console.log("======= raw data =======");
    console.log(stringify(data));
    console.log("======= decoded data =======");
    console.log(stringify(decodedData));

    var stringfiedDataSize = OneBuf.sizeOfUTF8String(JSON.stringify(data));
    var binaryDataSize = encodedData.byteLength;
    var compressRate = (((binaryDataSize / stringfiedDataSize) * 100) >> 0) / 100;
    console.log("======= data size =======");
    console.log("stringfiedDataSize: ", stringfiedDataSize);
    console.log("binaryDataSize: ", binaryDataSize);
    console.log("compress rate: ", compressRate);
};

function stringify(object) {
    return JSON.stringify(object, null, 2);
}

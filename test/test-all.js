"use strict";

var OneBuf = require("../OneBuf.js");

var testDir = "./";
var test1 = require(testDir + "test1.js");
var test2 = require(testDir + "test2.js");
var test3 = require(testDir + "test3.js");
var test4 = require(testDir + "test4.js");
var test5 = require(testDir + "test5.js");
var test6 = require(testDir + "test6.js");
var test7 = require(testDir + "test7.js");
var test8 = require(testDir + "test8.js");

var unitTests = [test1, test2, test3, test4, test5, test6, test7, test8];

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
    var compressRate = (binaryDataSize / stringfiedDataSize).toFixed(2);
    console.log("======= data size =======");
    console.log("stringfiedDataSize: ", stringfiedDataSize);
    console.log("binaryDataSize: ", binaryDataSize);
    console.log("compress rate: ", compressRate);
    console.log("\n");
}

function stringify(object) {
    return JSON.stringify(object, null, 2);
}

var unitTest;
for (var i = 0; i < unitTests.length; i++) {
    unitTest = unitTests[i];
    console.log("unitTest: ", i);
    doTest(unitTest.data, unitTest.schema, unitTest.schemaPool);
    console.log("-------------- unit test end -------------");
    console.log("                                          ");
    console.log("                                          ");
    console.log("                                          ");
    console.log("                                          ");
    console.log("                                          ");
    console.log("                                          ");
}










































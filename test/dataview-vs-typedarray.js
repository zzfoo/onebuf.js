var testCount = 10000;

function testDataView() {
    var bufferLength = 2048;
    var buffer = new ArrayBuffer(bufferLength);
    var dataView = new DataView(buffer);
    for (var i = 0; i < bufferLength; i++) {
        dataView.setInt8(i, i);
    }
    return buffer;
}

function testTypedArray() {
    var bufferLength = 2048;
    var buffer = new ArrayBuffer(bufferLength);
    var array = new Int8Array(buffer);

    var _array = new Int8Array(1);

    for (var i = 0; i < bufferLength; i++) {
        _array[0] = i;
        array[i] = _array[0];
    }
}


console.time('dataView');
for (var i = 0; i < testCount; i++) {
    testDataView();
}
console.timeEnd('dataView');


console.time('typedArray');
for (var i = 0; i < testCount; i++) {
    testTypedArray();
}
console.timeEnd('typedArray');

"use strict";

var FastDataView = require("./lib/FastDataView");

var OneBuf;

(function() {

    var MAX_ARRAY_LENGTH = (1 << 16) - 1;
    var IDX_BYTE = 2;
    var SIZE_BYTE = 2;
    var VALID_BYTE = 1;

    var BasicTypeLength = {
        "int8": 1, // -128, 127
        "uint8": 1, // 0, 255
        "int16": 2, // -32768, 32767
        "uint16": 2, // 0, 65535
        "int32": 4, // -2147483648, 2147483647
        "uint32": 4, // 0, 4294967295
        "float32": 4,
        "float64": 8,
        "int64": 8,
        "bool": 1,
        "boolean": 1,
        // "string": 0,
        // "map": 0,
    };

    var KeyTypeLength = {
        "int8": 1,
        "int16": 2,
        "int32": 4,
        "int64": 8,
        // "string": 0,
    };

    OneBuf = function(options) {
        options = options || {};
        this.schemaPool = options.schemaPool || {};
        this.schemaList = options.schemaList || [];
    };

    OneBuf.prototype.compileSchema = function(schema, fixed) {

        fixed = fixed || fixed === false ? fixed : (schema.fixed !== false);

        this.parseSchema(schema);

        schema.$fixed = fixed && schema.$canFixed;

        if (schema.$fixed) {
            schema.fixedLength = schema.$fixedLength;
        } else {
            schema.fixedLength = null;
        }

        return schema;
    };

    OneBuf.prototype.parseSchema = function(schema) {
        if (schema.$parsed) {
            return schema;
        }

        schema.id = schema.id || schema.name;
        this.schemaPool[schema.id] = schema;
        schema.$index = this.schemaList.length;
        this.schemaList.push(schema);

        schema.$parsed = true;

        var canFixed = true;
        var fixedLength = 0;

        if (schema.fields) {
            var fields = schema.fields;
            for (var i = 0; i < fields.length; i++) {
                var field = this.parseSchema(fields[i]);
                canFixed = canFixed && field.$canFixed;
                fixedLength += field.$fixedLength;
            }
            schema.$canFixed = canFixed;
            schema.$fixedLength = fixedLength;
            return schema;
        }

        var type = schema.type || "int8";

        // wholeString, type, sizeCfg, size, arrayCfg, arrayLength
        // 0,           1,      2,      3,      4,      5
        var reg = /([a-z0-9]+)(\((\d*)\))*(\[(\d*)\])*/;
        var check = type.match(reg);
        type = schema.type = check[1];

        if (check[4]) {
            schema.array = true;
        }

        var noop = function() {
            console.log("noop", this.type);
        };
        if (schema.type == "map") {
            schema.$readValue = ReadValueFuns[schema.valueType] || noop;
            schema.$writeValue = WriteValueFuns[schema.valueType] || noop;

            schema.$readKeyValue = ReadValueFuns[schema.keyType] || noop;
            schema.$writeKeyValue = WriteValueFuns[schema.keyType] || noop;
        } else {
            schema.$readValue = ReadValueFuns[schema.type] || noop;
            schema.$writeValue = WriteValueFuns[schema.type] || noop;
        }

        var subSchema = this.schemaPool[type];
        if (subSchema) {
            if (!subSchema.$canFixed) {
                canFixed = false;
            } else {
                fixedLength = subSchema.$fixedLength || 0;
            }
        } else if (type === "map") {
            canFixed = false;
        } else if (type === "string") {
            // schema.string = true;
            schema.$stringLength = parseInt(check[3]) || 0;
            if (!schema.$stringLength) {
                canFixed = false;
            } else {
                fixedLength = 2 + 2 * schema.$stringLength;
            }
        } else {
            fixedLength = this.getBasicTypeLength(type) || 0;
        }

        if (schema.array) {
            schema.array = true;
            schema.$arrayLength = parseInt(check[5]) || 0;
            if (!schema.$arrayLength) {
                canFixed = false;
            } else {
                fixedLength *= schema.$arrayLength;
            }
        }

        schema.$canFixed = canFixed;
        schema.$fixedLength = fixedLength;

        return schema;
    };

    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////


    OneBuf.prototype.encode = function(data, schemaId) {
        var schema = this.schemaPool[schemaId || data.schemaId];

        this.fixed = schema.$fixed;
        this.index = schema.$index;

        var bufferLength = IDX_BYTE;
        if (this.fixed) {
            bufferLength += schema.fixedLength;
        } else {
            bufferLength += this.calculateLength(schema, data, true);
        }

        // console.log("length: ", bufferLength);

        var buffer = new ArrayBuffer(bufferLength);

        this.dataView = new FastDataView(buffer);
        this.byteOffset = 0;
        this.dataView.setUint16(this.byteOffset, this.index);
        this.byteOffset += IDX_BYTE;

        this.writeData(schema, data, true);

        return buffer;
    };

    OneBuf.prototype.writeData = function(schema, data, top) {
        var optional = schema.optional;
        var dataView = this.dataView;
        if (optional && !top) {
            if (data === null || data === undefined) {
                dataView.setUint8(this.byteOffset, 0);
                this.byteOffset += VALID_BYTE;
                return;
            }
            dataView.setUint8(this.byteOffset, 1);
            this.byteOffset += VALID_BYTE;
        }

        var fields = schema.fields,
            array = schema.array,
            field;
        if (fields) {
            if (array) {
                var fieldCount = fields.length;
                var arrayLength;
                if (!this.fixed) {
                    arrayLength = data.length;
                    dataView.setUint16(this.byteOffset, arrayLength);
                    this.byteOffset += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }
                for (var i = 0; i < arrayLength; i++) {
                    var _data = data[i];
                    for (var j = 0; j < fieldCount; j++) {
                        field = fields[j];
                        this.writeData(field, _data[field.name]);
                    }
                }
            } else {
                var fieldCount = fields.length;
                for (var i = 0; i < fieldCount; i++) {
                    field = fields[i];
                    this.writeData(field, data[field.name]);
                }
            }
        } else {
            var type = schema.type;
            if (array) {
                var arrayLength;
                if (!this.fixed) {
                    arrayLength = data.length;
                    if (arrayLength > MAX_ARRAY_LENGTH) {
                        throw Error("Array too long");
                    }
                    dataView.setUint16(this.byteOffset, arrayLength);
                    this.byteOffset += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }
                for (var i = 0; i < arrayLength; i++) {
                    this.writeDataByType(type, data[i], schema);
                }
            } else {
                this.writeDataByType(type, data, schema);
            }
        }
    };


    OneBuf.prototype.writeDataByType = function(type, value, schema) {
        var subSchema = this.schemaPool[type];
        if (subSchema) {
            this.writeData(subSchema, value, true);
            return;
        }

        if (type === "map") {
            this.writeMap(value, schema);
            return;
        }

        return schema.$writeValue(this, this.dataView, value, schema);

    };

    OneBuf.prototype.writeMap = function(data, schema) {
        var dataView = this.dataView;
        var optional = schema.optional;
        var keyType = schema.keyType;
        var valueType = schema.valueType;
        var keyCount = Object.keys(data).length;

        var value;

        dataView.setUint16(this.byteOffset, keyCount);
        this.byteOffset += SIZE_BYTE;
        for (var key in data) {
            schema.$writeKeyValue(this, dataView, key, schema);

            value = data[key];
            if (optional) {
                if (value === null || value === undefined) {
                    dataView.setUint8(this.byteOffset, 0);
                    this.byteOffset += VALID_BYTE;
                    continue;
                }
                dataView.setUint8(this.byteOffset, 1);
                this.byteOffset += VALID_BYTE;
            }
            this.writeDataByType(valueType, value, schema);
        }
    };


    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////


    OneBuf.prototype.decode = function(buffer) {
        this.dataView = new FastDataView(buffer);
        this.byteOffset = 0;

        this.index = this.dataView.getUint16(this.byteOffset);
        this.byteOffset += IDX_BYTE;

        var schema = this.schemaList[this.index];
        var data = this.readData(schema, true);
        return data;
    };

    OneBuf.prototype.readData = function(schema, top) {
        var dataView = this.dataView;
        var optional = schema.optional;
        if (optional && !top) {
            var hasData = !!dataView.getUint8(this.byteOffset);
            this.byteOffset += VALID_BYTE;
            if (!hasData) {
                return null;
            }
        }

        var data;
        var fields = schema.fields,
            array = schema.array,
            field;

        if (fields) {
            if (array) {
                var fieldData;
                var fieldCount = fields.length;
                var arrayLength;
                if (!this.fixed) {
                    arrayLength = dataView.getUint16(this.byteOffset);
                    this.byteOffset += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }
                data = [];
                for (var i = 0; i < arrayLength; i++) {
                    fieldData = {};
                    data.push(fieldData);
                    for (var j = 0; j < fieldCount; j++) {
                        field = fields[j];
                        fieldData[field.name] = this.readData(field);
                    }
                }
            } else {
                var fieldData = {};
                var fieldCount = fields.length;
                for (var i = 0; i < fieldCount; i++) {
                    field = fields[i];
                    fieldData[field.name] = this.readData(field);
                }
                data = fieldData;
            }
        } else {
            var type = schema.type;
            if (array) {
                var arrayLength;
                if (!this.fixed) {
                    arrayLength = dataView.getUint16(this.byteOffset);
                    this.byteOffset += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }

                data = [];
                for (var i = 0; i < arrayLength; i++) {
                    data.push(this.readDataByType(type, schema));
                }
            } else {
                data = this.readDataByType(type, schema);
            }
        }
        return data;
    };


    OneBuf.prototype.readDataByType = function(type, schema) {
        var subSchema = this.schemaPool[type];
        if (subSchema) {
            return this.readData(subSchema, true);
        }
        if (type === "map") {
            return this.readMap(schema);
        }
        return schema.$readValue(this, this.dataView, schema);
    };

    OneBuf.prototype.readMap = function(schema) {
        var dataView = this.dataView;
        var optional = schema.optional;
        var keyType = schema.keyType;
        var valueType = schema.valueType;
        var keyCount = dataView.getUint16(this.byteOffset);
        this.byteOffset += SIZE_BYTE;

        var data = {};
        var key, value;

        for (var i = 0; i < keyCount; i++) {
            key = schema.$readKeyValue(this, dataView, schema);
            if (optional) {
                var hasValue = !!dataView.getUint8(this.byteOffset);
                this.byteOffset += VALID_BYTE;
                if (hasValue) {
                    value = this.readDataByType(valueType, schema);
                } else {
                    value = null;
                }
            } else {
                value = this.readDataByType(valueType, schema);
            }
            data[key] = value;
        }
        return data;
    };


    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////


    OneBuf.prototype.calculateLength = function(schema, data, top) {
        var optional = schema.optional;
        var bufferLength = 0;
        if (optional && !top) {
            bufferLength += VALID_BYTE;
            if (data === null || data === undefined) {
                return bufferLength;
            }
        }

        var fields = schema.fields,
            array = schema.array,
            field;
        if (fields) {
            var fieldCount = fields.length;
            if (array) {
                bufferLength += SIZE_BYTE;

                var arrayLength = data.length;
                for (var i = 0; i < arrayLength; i++) {
                    var _data = data[i];
                    for (var j = 0; j < fieldCount; j++) {
                        field = fields[j];
                        bufferLength += this.calculateLength(field, _data[field.name]);
                    }
                }
            } else {
                for (var i = 0; i < fieldCount; i++) {
                    field = fields[i];
                    bufferLength += this.calculateLength(field, data[field.name]);
                }
            }
        } else {
            var type = schema.type;
            if (array) {
                bufferLength += SIZE_BYTE;

                var arrayLength = data.length;
                for (var i = 0; i < arrayLength; i++) {
                    bufferLength += this.getTypeLength(type, data[i], schema);
                }
            } else {
                bufferLength += this.getTypeLength(type, data, schema);
            }
        }

        return bufferLength;
    };

    OneBuf.prototype.getTypeLength = function(type, value, schema) {
        var length;

        length = this.getBasicTypeLength(type, value);
        if (length !== undefined) {
            return length;
        }

        if (type === "string") {
            return this.getStringLength(value);
        }

        if (type === "map") {
            length = this.getMapLength(schema, value);
            return length;
        }

        var subSchema = this.schemaPool[type];
        if (subSchema) {
            length = this.calculateLength(subSchema, value, true);
            return length;
        }

        throw Error("Illigal type: " + type);

    };

    OneBuf.prototype.getMapLength = function(schema, data) {
        var optional = schema.optional;
        var validByte = optional ? VALID_BYTE : 0;
        // 2 byte for key count
        var length = SIZE_BYTE;
        var keyType = schema.keyType;
        var valueType = schema.valueType;
        var value;
        for (var key in data) {
            length += this.getKeyLength(keyType, key);
            value = data[key];
            length += validByte;
            if (value !== null || value !== undefined) {
                length += this.getTypeLength(valueType, value);
            }
        }
        return length;
    };

    OneBuf.prototype.getKeyLength = function(type, value) {
        if (type === "string") {
            return this.getStringLength(value);
        }

        var length = KeyTypeLength[type];
        if (length === undefined) {
            throw Error("Illigal key type: " + type);
        }

        return length;
    };

    OneBuf.prototype.getBasicTypeLength = function(type) {
        return BasicTypeLength[type];
    };

    OneBuf.prototype.getStringLength = function(value) {
        return 2 + 2 * value.length;
    };

    var ReadValueFuns = {
        "int8": function(one, dataView) {
            var value = dataView.getInt8(one.byteOffset);
            one.byteOffset += 1;
            return value;
        },
        "int16": function(one, dataView) {
            var value = dataView.getInt16(one.byteOffset);
            one.byteOffset += 2;
            return value;
        },
        "int32": function(one, dataView) {
            var value = dataView.getInt32(one.byteOffset);
            one.byteOffset += 4;
            return value;
        },
        "uint8": function(one, dataView) {
            var value = dataView.getUint8(one.byteOffset);
            one.byteOffset += 1;
            return value;
        },
        "uint16": function(one, dataView) {
            var value = dataView.getUint16(one.byteOffset);
            one.byteOffset += 2;
            return value;
        },
        "uint32": function(one, dataView) {
            var value = dataView.getUint32(one.byteOffset);
            one.byteOffset += 4;
            return value;
        },
        "float32": function(one, dataView) {
            var value = dataView.getFloat32(one.byteOffset);
            one.byteOffset += 4;
            return value;
        },
        "float64": function(one, dataView) {
            var value = dataView.getFloat64(one.byteOffset);
            one.byteOffset += 8;
            return value;
        },
        "int64": function(one, dataView) {
            var value = dataView.getFloat64(one.byteOffset);
            one.byteOffset += 8;
            return value;
        },
        "bool": function(one, dataView) {
            var value = dataView.getUint8(one.byteOffset) ? true : false;
            one.byteOffset += 1;
            return value;
        },
        "string": function(one, dataView, schema) {
            var stringLength;
            if (schema.$canFixed) {
                stringLength = schema.$stringLength;
            } else {
                stringLength = dataView.getUint16(one.byteOffset);
                one.byteOffset += 2;
            }
            var value = "";
            var char, code;
            for (var i = 0; i < stringLength; i++) {
                code = dataView.getUint16(one.byteOffset);
                one.byteOffset += 2;
                value += String.fromCharCode(code);
            }
            return value;
        },
    };
    ReadValueFuns["boolean"] = ReadValueFuns["bool"];


    var WriteValueFuns = {
        "int8": function(one, dataView, value) {
            dataView.setInt8(one.byteOffset, value);
            one.byteOffset += 1;
        },
        "int16": function(one, dataView, value) {
            dataView.setInt16(one.byteOffset, value);
            one.byteOffset += 2;
        },
        "int32": function(one, dataView, value) {
            dataView.setInt32(one.byteOffset, value);
            one.byteOffset += 4;
        },
        "uint8": function(one, dataView, value) {
            dataView.setUint8(one.byteOffset, value);
            one.byteOffset += 1;
        },
        "uint16": function(one, dataView, value) {
            dataView.setUint16(one.byteOffset, value);
            one.byteOffset += 2;
        },
        "uint32": function(one, dataView, value) {
            dataView.setUint32(one.byteOffset, value);
            one.byteOffset += 4;
        },
        "float32": function(one, dataView, value) {
            dataView.setFloat32(one.byteOffset, value);
            one.byteOffset += 4;
        },
        "float64": function(one, dataView, value) {
            dataView.setFloat64(one.byteOffset, value);
            one.byteOffset += 8;
        },
        "int64": function(one, dataView, value) {
            dataView.setFloat64(one.byteOffset, value);
            one.byteOffset += 8;
        },
        "bool": function(one, dataView, value) {
            value = value ? 1 : 0;
            dataView.setInt8(one.byteOffset, value);
            one.byteOffset += 1;
        },
        "string": function(one, dataView, value, schema) {
            var stringLength;
            if (schema.$canFixed) {
                stringLength = schema.$stringLength;
            } else {
                stringLength = value.length;
                dataView.setUint16(one.byteOffset, stringLength);
                one.byteOffset += 2;
            }
            for (var i = 0; i < stringLength; i++) {
                dataView.setUint16(one.byteOffset, value.charCodeAt(i));
                one.byteOffset += 2;
            }
        },
    };
    WriteValueFuns["boolean"] = WriteValueFuns["bool"];

    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////


    OneBuf.sizeOfUTF8String = function(str) {
        if (!str) {
            return 0;
        }
        var sizeInBytes = str.split('')
            .map(function(ch) {
                return ch.charCodeAt(0);
            }).map(function(uchar) {
                return uchar < 128 ? 1 : 2;
            }).reduce(function(curr, next) {
                return curr + next;
            });

        return sizeInBytes;
    };


    if (typeof module === "object" && module && module["exports"]) {
        module["exports"] = OneBuf;
    }

}());

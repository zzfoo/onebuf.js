"use strict";

var OneBuf = OneBuf || {};

(function() {

    OneBuf.loadSchema = function(schema) {
        return new Struct(schema);
    };
    OneBuf.getId = function(struct) {
        return struct.getUint16(0);
    };
    OneBuf.schemaPool = {};

    var MAX_ARRAY_LENGTH = (1 << 16) - 1;
    var ID_BYTE = 2;
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

    var Struct = function(schema, fixed) {
        schema.name = schema.name || schema.id;
        OneBuf.schemaPool[schema.name] = schema;

        this.schema = schema;
        this.id = schema.id;
        this.name = schema.name;
        this.fields = schema.fields;
        this._fixed = fixed || fixed === false ? fixed : (schema.fixed !== false);

        this.initShareArray();

        // this.useDataView();

        this.compile();
    };

    Struct.prototype.compile = function() {
        this.fixedLength = 0;
        this.fixed = this._fixed;
        // this.fixed = true;
        // this.fixed = false;
        if (!this.schema.$compiled) {
            this.parseSchema(this.schema);
            this.schema.$compiled = true;
        } else {
            this.fixed = this.schema.$canFixed;
        }
        // console.log(this.fixed)
        // console.log("fixed:", this.id, this._fixed, this.fixed, this.fixedLength);
        if (!this.fixed) {
            this.fixedLength = null;
        }
        // this.schema.$fixedLength = this.fixedLength;
        // console.log("schema.$canFixed", this.schema.$canFixed);
        // console.log("schema.$fixedLength", this.schema.$fixedLength);
        // console.log('==============')
        // console.log(JSON.stringify(this.schema,null,2));
        // console.log('==============')
    };

    Struct.prototype.parseSchema = function(schema) {
        var canFixed = true;
        var fixedLength = 0;

        if (schema.fields) {
            var fields = schema.fields;
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i];
                this.parseSchema(field);
                canFixed = canFixed && field.$canFixed;
                fixedLength += field.fixedLength;
            }
            schema.$canFixed = canFixed;
            schema.$fixedLength = fixedLength;
            return;
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

        if (!this.fixed) {
            schema.$canFixed = false;
            schema.$fixedLength = 0;
            return;
        }

        var subSchema = OneBuf.schemaPool[type];
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

        this.fixed = this.fixed && canFixed;
        if (this.fixed) {
            this.fixedLength += fixedLength;
            schema.$_optional = schema.optional;
            schema.optional = false;
        }
    };

    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////

    Struct.prototype.initShareArray = function(offset, value) {
        this.shareBuffer = new ArrayBuffer(8);

        this.uint8Array = new Uint8Array(this.shareBuffer);
        this.int8Array = new Int8Array(this.shareBuffer);

        this.uint16Array = new Uint16Array(this.shareBuffer);
        this.int16Array = new Int16Array(this.shareBuffer);

        this.uint32Array = new Uint32Array(this.shareBuffer);
        this.int32Array = new Int32Array(this.shareBuffer);

        this.float32Array = new Float32Array(this.shareBuffer);
        this.float64Array = new Float64Array(this.shareBuffer);
    };

    Struct.prototype.setUint8 = function(offset, value) {
        this.globalArray[offset] = value;
    };
    Struct.prototype.getUint8 = function(offset) {
        return this.globalArray[offset];
    };

    Struct.prototype.setInt8 = function(offset, value) {
        this.globalArray[offset] = value;
    };
    Struct.prototype.getInt8 = function(offset) {
        // return this.globalArray[offset];
        this.uint8Array[0] = this.globalArray[offset];
        return this.int8Array[0];
    };

    Struct.prototype.setUint16 = function(offset, value) {
        this.globalArray[offset] = value >>> 8;
        this.globalArray[offset + 1] = value;
    };
    Struct.prototype.getUint16 = function(offset) {
        var a = this.globalArray[offset];
        var b = this.globalArray[offset + 1];
        return (a << 8) | b;
    };

    Struct.prototype.setInt16 = function(offset, value) {
        this.globalArray[offset] = value >>> 8;
        this.globalArray[offset + 1] = value;
    };
    Struct.prototype.getInt16 = function(offset) {
        // var a = this.globalArray[offset];
        // var b = this.globalArray[offset + 1];
        // return (a << 8) | b;
        this.uint8Array[0] = this.globalArray[offset + 1];
        this.uint8Array[1] = this.globalArray[offset];
        return this.int16Array[0];
    };

    Struct.prototype.setInt32 = function(offset, value) {
        this.globalArray[offset] = value >>> 24;
        this.globalArray[offset + 1] = (value >>> 16);
        this.globalArray[offset + 2] = (value >>> 8);
        this.globalArray[offset + 3] = value;
    };
    Struct.prototype.getInt32 = function(offset) {
        // var a = this.globalArray[offset];
        // var b = this.globalArray[offset + 1];
        // var c = this.globalArray[offset + 2];
        // var d = this.globalArray[offset + 3];
        // return (a << 24) | (b << 16) | (c << 8) | d;
        this.uint8Array[0] = this.globalArray[offset + 3];
        this.uint8Array[1] = this.globalArray[offset + 2];
        this.uint8Array[2] = this.globalArray[offset + 1];
        this.uint8Array[3] = this.globalArray[offset];
        return this.int32Array[0];
    };


    Struct.prototype.setFloat32 = function(offset, value) {
        this.float32Array[0] = value;
        this.globalArray[offset] = this.uint8Array[3];
        this.globalArray[offset + 1] = this.uint8Array[2];
        this.globalArray[offset + 2] = this.uint8Array[1];
        this.globalArray[offset + 3] = this.uint8Array[0];
    };
    Struct.prototype.getFloat32 = function(offset) {
        this.uint8Array[0] = this.globalArray[offset + 3];
        this.uint8Array[1] = this.globalArray[offset + 2];
        this.uint8Array[2] = this.globalArray[offset + 1];
        this.uint8Array[3] = this.globalArray[offset];
        return this.float32Array[0];
    };

    Struct.prototype.setFloat64 = function(offset, value) {
        this.float64Array[0] = value;
        this.globalArray[offset] = this.uint8Array[7];
        this.globalArray[offset + 1] = this.uint8Array[6];
        this.globalArray[offset + 2] = this.uint8Array[5];
        this.globalArray[offset + 3] = this.uint8Array[4];
        this.globalArray[offset + 4] = this.uint8Array[3];
        this.globalArray[offset + 5] = this.uint8Array[2];
        this.globalArray[offset + 6] = this.uint8Array[1];
        this.globalArray[offset + 7] = this.uint8Array[0];
    };
    Struct.prototype.getFloat64 = function(offset) {
        this.uint8Array[0] = this.globalArray[offset + 7];
        this.uint8Array[1] = this.globalArray[offset + 6];
        this.uint8Array[2] = this.globalArray[offset + 5];
        this.uint8Array[3] = this.globalArray[offset + 4];
        this.uint8Array[4] = this.globalArray[offset + 3];
        this.uint8Array[5] = this.globalArray[offset + 2];
        this.uint8Array[6] = this.globalArray[offset + 1];
        this.uint8Array[7] = this.globalArray[offset];
        return this.float64Array[0];
    };

    Struct.prototype.setUint32 = function(offset, value) {
        // this.dataView.setUint32(offset, value);
        this.globalArray[offset] = value >>> 24;
        this.globalArray[offset + 1] = (value >>> 16);
        this.globalArray[offset + 2] = (value >>> 8);
        this.globalArray[offset + 3] = value;
    };
    Struct.prototype.getUint32 = function(offset) {
        return this.dataView.getUint32(offset);
        // var a = this.globalArray[offset];
        // var b = this.globalArray[offset + 1];
        // var c = this.globalArray[offset + 2];
        // var d = this.globalArray[offset + 3];
        // return (a << 24) | (b << 16) | (c << 8) | d;
    };

    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////

    Struct.prototype.useDataView = function() {
        this.setUint8 = function(offset, value) {
            this.dataView.setUint8(offset, value);
        };
        this.getUint8 = function(offset) {
            return this.dataView.getUint8(offset);
        };

        this.setInt8 = function(offset, value) {
            this.dataView.setInt8(offset, value);
        };
        this.getInt8 = function(offset) {
            return this.dataView.getInt8(offset);
        };

        this.setUint16 = function(offset, value) {
            this.dataView.setUint16(offset, value);
        };
        this.getUint16 = function(offset) {
            return this.dataView.getUint16(offset);
        };

        this.setInt16 = function(offset, value) {
            this.dataView.setInt16(offset, value);
        };
        this.getInt16 = function(offset) {
            return this.dataView.getInt16(offset);
        };

        this.setInt32 = function(offset, value) {
            this.dataView.setInt32(offset, value);
        };
        this.getInt32 = function(offset) {
            return this.dataView.getInt32(offset);
        };

        this.setFloat32 = function(offset, value) {
            this.dataView.setFloat32(offset, value);
        };
        this.getFloat32 = function(offset) {
            return this.dataView.getFloat32(offset);
        };

        this.setFloat64 = function(offset, value) {
            this.dataView.setFloat64(offset, value);
        };
        this.getFloat64 = function(offset) {
            return this.dataView.getFloat64(offset);
        };

        this.setUint32 = function(offset, value) {
            this.dataView.setUint32(offset, value);
        };
        this.getUint32 = function(offset) {
            return this.dataView.getUint32(offset);
        };
    };

    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////


    Struct.prototype.jsonToBinary = function(data) {
        var fields = this.fields,
            field;
        var bufferLength = ID_BYTE;
        if (this.fixed) {
            bufferLength += this.fixedLength;
            // console.log("fixed Length: ", this.fixedLength === this.calculateLength(this.schema, data, true));
        } else {
            bufferLength += this.calculateLength(this.schema, data, true);
        }

        // console.log("length: ", bufferLength);


        var buffer = new ArrayBuffer(bufferLength);

        this.globalArray = new Uint8Array(buffer);
        this.dataView = new DataView(buffer);
        this.dataOffset = 0;

        this.setUint16(this.dataOffset, this.schema.id);
        this.dataOffset += ID_BYTE;

        this.writeToBuffer(this.schema, data, true);

        return buffer;
    };
    Struct.prototype.encode = Struct.prototype.jsonToBinary;

    Struct.prototype.calculateLength = function(schema, data, top) {
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

    Struct.prototype.writeToBuffer = function(schema, data, top) {
        var optional = schema.optional;
        if (optional && !top) {
            if (data === null || data === undefined) {
                this.setInt8(this.dataOffset, 0);
                this.dataOffset += VALID_BYTE;
                return;
            }
            this.setInt8(this.dataOffset, 1);
            this.dataOffset += VALID_BYTE;
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
                    this.setUint16(this.dataOffset, arrayLength);
                    this.dataOffset += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }
                for (var i = 0; i < arrayLength; i++) {
                    var _data = data[i];
                    for (var j = 0; j < fieldCount; j++) {
                        field = fields[j];
                        this.writeToBuffer(field, _data[field.name]);
                    }
                }
            } else {
                var fieldCount = fields.length;
                for (var i = 0; i < fieldCount; i++) {
                    field = fields[i];
                    this.writeToBuffer(field, data[field.name]);
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
                    this.setUint16(this.dataOffset, arrayLength);
                    this.dataOffset += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }
                for (var i = 0; i < arrayLength; i++) {
                    this.writeTypeToBuffer(type, data[i], schema);
                }
            } else {
                this.writeTypeToBuffer(type, data, schema);
            }
        }
    };


    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////


    Struct.prototype.binaryToJSON = function(buffer) {
        this.globalArray = new Uint8Array(buffer);
        this.dataView = new DataView(buffer);
        this.dataOffset = ID_BYTE;

        var data = this.readJSON(this.schema, true);
        return data;
    };
    Struct.prototype.decode = Struct.prototype.binaryToJSON;


    Struct.prototype.readJSON = function(schema, top) {
        var optional = schema.optional;
        if (optional && !top) {
            var hasData = !!this.getInt8(this.dataOffset);
            this.dataOffset += VALID_BYTE;
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
                    arrayLength = this.getUint16(this.dataOffset);
                    this.dataOffset += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }
                data = [];
                for (var i = 0; i < arrayLength; i++) {
                    fieldData = {};
                    data.push(fieldData);
                    for (var j = 0; j < fieldCount; j++) {
                        field = fields[j];
                        fieldData[field.name] = this.readJSON(field);
                    }
                }
            } else {
                var fieldData = {};
                var fieldCount = fields.length;
                for (var i = 0; i < fieldCount; i++) {
                    field = fields[i];
                    fieldData[field.name] = this.readJSON(field);
                }
                data = fieldData;
            }
        } else {
            var type = schema.type;
            if (array) {
                var arrayLength;
                if (!this.fixed) {
                    arrayLength = this.getUint16(this.dataOffset);
                    this.dataOffset += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }

                data = [];
                for (var i = 0; i < arrayLength; i++) {
                    data.push(this.readTypeJSON(type, schema));
                }
            } else {
                data = this.readTypeJSON(type, schema);
            }
        }
        return data;
    };

    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////

    Struct.prototype.getTypeLength = function(type, value, schema) {
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

        var subSchema = OneBuf.schemaPool[type];
        if (subSchema) {
            length = this.calculateLength(subSchema, value, true);
            return length;
        }

        throw Error("Illigal type: " + type);

    };

    Struct.prototype.getMapLength = function(schema, data) {
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

    Struct.prototype.getKeyLength = function(type, value) {
        if (type === "string") {
            return this.getStringLength(value);
        }

        var length = KeyTypeLength[type];
        if (length === undefined) {
            throw Error("Illigal key type: " + type);
        }

        return length;
    };

    Struct.prototype.getBasicTypeLength = function(type) {
        return BasicTypeLength[type];
    };

    Struct.prototype.getStringLength = function(value) {
        return 2 + 2 * value.length;
    };


    Struct.prototype.readTypeJSON = function(type, schema) {

        var subSchema = OneBuf.schemaPool[type];
        if (subSchema) {
            return this.readJSON(subSchema, true);
        }
        if (type === "map") {
            return this.readMapJSON(schema);
        }
        return schema.$readValue(this, schema);
    };

    Struct.prototype.readMapJSON = function(schema) {
        var optional = schema.optional;
        var dataView = this.dataView;
        var keyType = schema.keyType;
        var valueType = schema.valueType;
        var keyCount = this.getUint16(this.dataOffset);
        this.dataOffset += SIZE_BYTE;

        var data = {};
        var key, value;

        for (var i = 0; i < keyCount; i++) {
            key = schema.$readKeyValue(this, dataView, schema);
            if (optional) {
                var hasValue = !!dataView.getInt8(this.dataOffset);
                this.dataOffset += VALID_BYTE;
                if (hasValue) {
                    value = this.readTypeJSON(valueType, schema);
                } else {
                    value = null;
                }
            } else {
                value = this.readTypeJSON(valueType, schema);
            }
            data[key] = value;
        }
        return data;
    };

    Struct.prototype.writeTypeToBuffer = function(type, value, schema) {
        var subSchema = OneBuf.schemaPool[type];
        if (subSchema) {
            this.writeToBuffer(subSchema, value, true);
            return;
        }

        if (type === "map") {
            this.writeMapToBuffer(value, schema);
            return;
        }

        return schema.$writeValue(this, value, schema);

    };

    Struct.prototype.writeMapToBuffer = function(data, schema) {
        var optional = schema.optional;
        var dataView = this.dataView;
        var keyType = schema.keyType;
        var valueType = schema.valueType;
        var keyCount = Object.keys(data).length;

        var value;

        this.setUint16(this.dataOffset, keyCount);
        this.dataOffset += SIZE_BYTE;
        for (var key in data) {
            schema.$writeKeyValue(this, key, schema);

            value = data[key];
            if (optional) {
                if (value === null || value === undefined) {
                    this.setInt8(this.dataOffset, 0);
                    this.dataOffset += VALID_BYTE;
                    continue;
                }
                this.setInt8(this.dataOffset, 1);
                this.dataOffset += VALID_BYTE;
            }
            this.writeTypeToBuffer(valueType, value, schema);
        }
    };


    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////


    var ReadValueFuns = {
        "int8": function(struct) {
            var value = struct.getInt8(struct.dataOffset);
            struct.dataOffset += 1;
            return value;
        },
        "int16": function(struct) {
            var value = struct.getInt16(struct.dataOffset);
            struct.dataOffset += 2;
            return value;
        },
        "int32": function(struct) {
            var value = struct.getInt32(struct.dataOffset);
            struct.dataOffset += 4;
            return value;
        },
        "uint8": function(struct) {
            var value = struct.getUint8(struct.dataOffset);
            struct.dataOffset += 1;
            return value;
        },
        "uint16": function(struct) {
            var value = struct.getUint16(struct.dataOffset);
            struct.dataOffset += 2;
            return value;
        },
        "uint32": function(struct) {
            var value = struct.getUint32(struct.dataOffset);
            struct.dataOffset += 4;
            return value;
        },
        "float32": function(struct) {
            var value = struct.getFloat32(struct.dataOffset);
            struct.dataOffset += 4;
            return value;
        },
        "float64": function(struct) {
            var value = struct.getFloat64(struct.dataOffset);
            struct.dataOffset += 8;
            return value;
        },
        "int64": function(struct) {
            var value = struct.getFloat64(struct.dataOffset);
            struct.dataOffset += 8;
            return value;
        },
        "bool": function(struct) {
            var value = struct.getInt8(struct.dataOffset) ? true : false;
            struct.dataOffset += 1;
            return value;
        },
        "string": function(struct, schema) {
            var stringLength;
            if (schema.$canFixed) {
                stringLength = schema.$stringLength;
            } else {
                stringLength = struct.getUint16(struct.dataOffset);
                struct.dataOffset += 2;
            }
            var value = "";
            var char, code;
            for (var i = 0; i < stringLength; i++) {
                code = struct.getUint16(struct.dataOffset);
                struct.dataOffset += 2;
                value += String.fromCharCode(code);
            }
            return value;
        },
    };
    ReadValueFuns["boolean"] = ReadValueFuns["bool"];


    var WriteValueFuns = {
        "int8": function(struct, value) {
            struct.setInt8(struct.dataOffset, value);
            struct.dataOffset += 1;
        },
        "int16": function(struct, value) {
            struct.setInt16(struct.dataOffset, value);
            struct.dataOffset += 2;
        },
        "int32": function(struct, value) {
            struct.setInt32(struct.dataOffset, value);
            struct.dataOffset += 4;
        },
        "uint8": function(struct, value) {
            struct.setUint8(struct.dataOffset, value);
            struct.dataOffset += 1;
        },
        "uint16": function(struct, value) {
            struct.setUint16(struct.dataOffset, value);
            struct.dataOffset += 2;
        },
        "uint32": function(struct, value) {
            struct.setUint32(struct.dataOffset, value);
            struct.dataOffset += 4;
        },
        "float32": function(struct, value) {
            struct.setFloat32(struct.dataOffset, value);
            struct.dataOffset += 4;
        },
        "float64": function(struct, value) {
            struct.setFloat64(struct.dataOffset, value);
            struct.dataOffset += 8;
        },
        "int64": function(struct, value) {
            struct.setFloat64(struct.dataOffset, value);
            struct.dataOffset += 8;
        },
        "bool": function(struct, value) {
            value = value ? 1 : 0;
            struct.setInt8(struct.dataOffset, value);
            struct.dataOffset += 1;
        },
        "string": function(struct, value, schema) {
            var stringLength;
            if (schema.$canFixed) {
                stringLength = schema.$stringLength;
            } else {
                stringLength = value.length;
                struct.setUint16(struct.dataOffset, stringLength);
                struct.dataOffset += 2;
            }
            for (var i = 0; i < stringLength; i++) {
                struct.setUint16(struct.dataOffset, value.charCodeAt(i));
                struct.dataOffset += 2;
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

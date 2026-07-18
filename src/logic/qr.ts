// @ts-nocheck -- M26 交付的零依赖 QR 编码器，与 python-qrcode 逐位交叉验证后冻结；
// 保持逐字原样（含 var/无类型标注），避免类型化改写引入转录错误。M38 仅迁移为模块并导出。
/* ================= M26 QR 编码器（零依赖 ISO/IEC 18004，byte 模式 + 纠错 M；与 python-qrcode 参考实现逐位交叉验证，含 V40-M 容量边界） ================= */
// qr.js -- zero-dependency QR Code encoder (ISO/IEC 18004), ECC level M, byte mode only.
// Pure ES2017, no import/export, no Node APIs, no DOM. Safe to inline into a browser page
// or run under JavaScriptCore (osascript -l JavaScript).
//
// Public API:
//   qrEncode(text) -> { version, mask, size, modules }
//     - version: 1..40 (smallest version at ECC level M that fits the UTF-8 byte-mode data)
//     - mask: 0..7 (chosen by ISO/IEC 18004 penalty rules, lowest total score wins ties by
//       lowest mask index)
//     - size: modules per side (= version*4 + 17)
//     - modules: size x size array of arrays of 0/1 (1 = dark), no quiet zone included
//
// Throws Error if the text does not fit into version 40 at ECC level M.

// ---------------------------------------------------------------------------
// Ground-truth tables (ISO/IEC 18004 Annex, cross-checked against the Python
// `qrcode` reference implementation's util.PATTERN_POSITION_TABLE and
// base.RS_BLOCK_TABLE, extracted at development time).
// ---------------------------------------------------------------------------

// Alignment pattern center coordinates, indexed by version-1.
var QR_ALIGN_POS = [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70],
    [6, 26, 50, 74],
    [6, 30, 54, 78],
    [6, 30, 56, 82],
    [6, 30, 58, 86],
    [6, 34, 62, 90],
    [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98],
    [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114],
    [6, 34, 62, 90, 118],
    [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130],
    [6, 30, 56, 82, 108, 134],
    [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142],
    [6, 34, 62, 90, 118, 146],
    [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158],
    [6, 32, 58, 84, 110, 136, 162],
    [6, 26, 54, 82, 110, 138, 166],
    [6, 30, 58, 86, 114, 142, 170]
];

// RS block structure for ERROR CORRECTION LEVEL M, indexed by version-1.
// Each row is a flat tuple list: [count, totalCodewords, dataCodewords, ...]
// (a row may have one or two groups of blocks, matching ISO/IEC 18004 Table 9).
var QR_RS_BLOCKS_M = [
    [1, 26, 16],
    [1, 44, 28],
    [1, 70, 44],
    [2, 50, 32],
    [2, 67, 43],
    [4, 43, 27],
    [4, 49, 31],
    [2, 60, 38, 2, 61, 39],
    [3, 58, 36, 2, 59, 37],
    [4, 69, 43, 1, 70, 44],
    [1, 80, 50, 4, 81, 51],
    [6, 58, 36, 2, 59, 37],
    [8, 59, 37, 1, 60, 38],
    [4, 64, 40, 5, 65, 41],
    [5, 65, 41, 5, 66, 42],
    [7, 73, 45, 3, 74, 46],
    [10, 74, 46, 1, 75, 47],
    [9, 69, 43, 4, 70, 44],
    [3, 70, 44, 11, 71, 45],
    [3, 67, 41, 13, 68, 42],
    [17, 68, 42],
    [17, 74, 46],
    [4, 75, 47, 14, 76, 48],
    [6, 73, 45, 14, 74, 46],
    [8, 75, 47, 13, 76, 48],
    [19, 74, 46, 4, 75, 47],
    [22, 73, 45, 3, 74, 46],
    [3, 73, 45, 23, 74, 46],
    [21, 73, 45, 7, 74, 46],
    [19, 75, 47, 10, 76, 48],
    [2, 74, 46, 29, 75, 47],
    [10, 74, 46, 23, 75, 47],
    [14, 74, 46, 21, 75, 47],
    [14, 74, 46, 23, 75, 47],
    [12, 75, 47, 26, 76, 48],
    [6, 75, 47, 34, 76, 48],
    [29, 74, 46, 14, 75, 47],
    [13, 74, 46, 32, 75, 47],
    [40, 75, 47, 7, 76, 48],
    [18, 75, 47, 31, 76, 48]
];

// BCH constants (ISO/IEC 18004 Annex C/D).
var QR_G15 = 0x537;   // format info generator polynomial, degree 10
var QR_G18 = 0x1F25;  // version info generator polynomial, degree 12
var QR_G15_MASK = 0x5412;

// ---------------------------------------------------------------------------
// UTF-8 encoding (no TextEncoder available in JavaScriptCore).
// ---------------------------------------------------------------------------

function qrUtf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
        var code = str.codePointAt(i);
        if (code > 0xFFFF) {
            i++; // this code point consumed a surrogate pair; skip the low surrogate
        }
        if (code < 0x80) {
            bytes.push(code);
        } else if (code < 0x800) {
            bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
        } else if (code < 0x10000) {
            bytes.push(
                0xE0 | (code >> 12),
                0x80 | ((code >> 6) & 0x3F),
                0x80 | (code & 0x3F)
            );
        } else {
            bytes.push(
                0xF0 | (code >> 18),
                0x80 | ((code >> 12) & 0x3F),
                0x80 | ((code >> 6) & 0x3F),
                0x80 | (code & 0x3F)
            );
        }
    }
    return bytes;
}

// ---------------------------------------------------------------------------
// Bit buffer helpers (plain array of 0/1 ints).
// ---------------------------------------------------------------------------

function qrPutBits(bitArray, num, length) {
    for (var i = length - 1; i >= 0; i--) {
        bitArray.push((num >>> i) & 1);
    }
}

function qrBitsToBytes(bitArray) {
    var bytes = [];
    for (var i = 0; i < bitArray.length; i += 8) {
        var b = 0;
        for (var k = 0; k < 8; k++) {
            b = (b << 1) | bitArray[i + k];
        }
        bytes.push(b & 0xFF);
    }
    return bytes;
}

// ---------------------------------------------------------------------------
// GF(256) arithmetic and Reed-Solomon error correction coding.
// Primitive polynomial x^8+x^4+x^3+x^2+1 (0x11D), generator element 2.
// ---------------------------------------------------------------------------

function qrGfMultiply(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11D);
        z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
}

// Computes the generator polynomial coefficients for `degree` EC codewords.
function qrRsGenerator(degree) {
    var result = new Array(degree);
    for (var i = 0; i < degree; i++) result[i] = 0;
    result[degree - 1] = 1;
    var root = 1;
    for (var i = 0; i < degree; i++) {
        for (var j = 0; j < degree; j++) {
            result[j] = qrGfMultiply(result[j], root);
            if (j + 1 < degree) result[j] ^= result[j + 1];
        }
        root = qrGfMultiply(root, 0x02);
    }
    return result;
}

// Polynomial division remainder: dataBytes (message) mod generator -> EC codewords.
function qrRsRemainder(dataBytes, generator) {
    var result = new Array(generator.length);
    for (var i = 0; i < result.length; i++) result[i] = 0;
    for (var b = 0; b < dataBytes.length; b++) {
        var factor = dataBytes[b] ^ result[0];
        result.shift();
        result.push(0);
        for (var i = 0; i < result.length; i++) {
            result[i] ^= qrGfMultiply(generator[i], factor);
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// BCH error-correcting codes for format info (15,5) and version info (18,6).
// ---------------------------------------------------------------------------

function qrBchTypeInfo(data) {
    // data: 5-bit value = (eccIndicator << 3) | maskPattern; eccIndicator(M) = 0b00.
    var d = data;
    for (var i = 0; i < 10; i++) {
        d = (d << 1) ^ ((d >>> 9) * QR_G15);
    }
    var bits = ((data << 10) | (d & 0x3FF)) ^ QR_G15_MASK;
    return bits & 0x7FFF;
}

function qrBchTypeNumber(version) {
    var d = version;
    for (var i = 0; i < 12; i++) {
        d = (d << 1) ^ ((d >>> 11) * QR_G18);
    }
    return ((version << 12) | (d & 0xFFF)) >>> 0;
}

// ---------------------------------------------------------------------------
// Version capacity / block structure helpers.
// ---------------------------------------------------------------------------

function qrCharCountBits(version) {
    return version < 10 ? 8 : 16; // byte mode only has two tiers
}

// Returns array of { data: dataCodewordCount, ecc: eccCodewordCount } per block.
function qrGetBlocks(version) {
    var row = QR_RS_BLOCKS_M[version - 1];
    var blocks = [];
    for (var i = 0; i < row.length; i += 3) {
        var count = row[i];
        var total = row[i + 1];
        var data = row[i + 2];
        for (var k = 0; k < count; k++) {
            blocks.push({ data: data, ecc: total - data });
        }
    }
    return blocks;
}

function qrCapacityBits(version) {
    var blocks = qrGetBlocks(version);
    var bits = 0;
    for (var i = 0; i < blocks.length; i++) bits += blocks[i].data * 8;
    return bits;
}

// ---------------------------------------------------------------------------
// Mask pattern functions (ISO/IEC 18004 Table 20). i = row, j = column.
// ---------------------------------------------------------------------------

function qrMaskFunction(pattern) {
    switch (pattern) {
        case 0: return function (i, j) { return (i + j) % 2 === 0; };
        case 1: return function (i, j) { return i % 2 === 0; };
        case 2: return function (i, j) { return j % 3 === 0; };
        case 3: return function (i, j) { return (i + j) % 3 === 0; };
        case 4: return function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; };
        case 5: return function (i, j) { return (i * j) % 2 + (i * j) % 3 === 0; };
        case 6: return function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 === 0; };
        case 7: return function (i, j) { return ((i * j) % 3 + (i + j) % 2) % 2 === 0; };
        default: throw new Error("Bad mask pattern: " + pattern);
    }
}

// ---------------------------------------------------------------------------
// Matrix construction.
// ---------------------------------------------------------------------------

function qrBuildMatrix(version, maskPattern, codewordBytes) {
    var size = version * 4 + 17;
    var modules = new Array(size);
    var isSet = new Array(size);
    for (var y = 0; y < size; y++) {
        modules[y] = new Array(size);
        isSet[y] = new Array(size);
        for (var x = 0; x < size; x++) {
            modules[y][x] = false;
            isSet[y][x] = false;
        }
    }

    function setModule(r, c, val) {
        modules[r][c] = val;
        isSet[r][c] = true;
    }

    function drawProbe(row, col) {
        for (var r = -1; r < 8; r++) {
            if (row + r <= -1 || size <= row + r) continue;
            for (var c = -1; c < 8; c++) {
                if (col + c <= -1 || size <= col + c) continue;
                var dark =
                    (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                    (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                    (r >= 2 && r <= 4 && c >= 2 && c <= 4);
                setModule(row + r, col + c, dark);
            }
        }
    }
    drawProbe(0, 0);
    drawProbe(size - 7, 0);
    drawProbe(0, size - 7);

    // Alignment patterns.
    var pos = QR_ALIGN_POS[version - 1];
    for (var i = 0; i < pos.length; i++) {
        var row = pos[i];
        for (var j = 0; j < pos.length; j++) {
            var col = pos[j];
            if (isSet[row][col]) continue;
            for (var r = -2; r <= 2; r++) {
                for (var c = -2; c <= 2; c++) {
                    var dark = (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0));
                    setModule(row + r, col + c, dark);
                }
            }
        }
    }

    // Timing patterns.
    for (var r = 8; r < size - 8; r++) {
        if (!isSet[r][6]) setModule(r, 6, r % 2 === 0);
    }
    for (var c = 8; c < size - 8; c++) {
        if (!isSet[6][c]) setModule(6, c, c % 2 === 0);
    }

    // Format (type) info -- ECC level M => eccIndicator bits = 0b00.
    var formatData = maskPattern & 0x7;
    var bits15 = qrBchTypeInfo(formatData);
    for (var i = 0; i < 15; i++) {
        var mod = ((bits15 >>> i) & 1) === 1;
        if (i < 6) setModule(i, 8, mod);
        else if (i < 8) setModule(i + 1, 8, mod);
        else setModule(size - 15 + i, 8, mod);
    }
    for (var i = 0; i < 15; i++) {
        var mod = ((bits15 >>> i) & 1) === 1;
        if (i < 8) setModule(8, size - i - 1, mod);
        else if (i < 9) setModule(8, 15 - i - 1 + 1, mod);
        else setModule(8, 15 - i - 1, mod);
    }
    setModule(size - 8, 8, true); // dark module, always dark

    // Version info (version >= 7).
    if (version >= 7) {
        var bits18 = qrBchTypeNumber(version);
        for (var i = 0; i < 18; i++) {
            var mod = ((bits18 >>> i) & 1) === 1;
            var a = Math.floor(i / 3);
            var b = (i % 3) + size - 11;
            setModule(a, b, mod);
            setModule(b, a, mod);
        }
    }

    // Data placement in zigzag (boustrophedon) order, with masking applied.
    var maskFn = qrMaskFunction(maskPattern);
    var dataLen = codewordBytes.length;
    var mrow = size - 1;
    var inc = -1;
    var bitIndex = 7;
    var byteIndex = 0;

    for (var rawCol = size - 1; rawCol > 0; rawCol -= 2) {
        var col = rawCol;
        if (col <= 6) col -= 1;
        var colRange = [col, col - 1];
        for (;;) {
            for (var ci = 0; ci < 2; ci++) {
                var cc = colRange[ci];
                if (!isSet[mrow][cc]) {
                    var dark = false;
                    if (byteIndex < dataLen) {
                        dark = ((codewordBytes[byteIndex] >>> bitIndex) & 1) === 1;
                    }
                    if (maskFn(mrow, cc)) dark = !dark;
                    modules[mrow][cc] = dark;
                    isSet[mrow][cc] = true;
                    bitIndex--;
                    if (bitIndex === -1) {
                        byteIndex++;
                        bitIndex = 7;
                    }
                }
            }
            mrow += inc;
            if (mrow < 0 || size <= mrow) {
                mrow -= inc;
                inc = -inc;
                break;
            }
        }
    }

    return { modules: modules, size: size };
}

// ---------------------------------------------------------------------------
// Penalty scoring (ISO/IEC 18004 8.8.2, four rules).
// ---------------------------------------------------------------------------

function qrPenaltyRule1(modules, size) {
    var penalty = 0;
    for (var y = 0; y < size; y++) {
        var runColor = modules[y][0];
        var runLen = 1;
        for (var x = 1; x < size; x++) {
            if (modules[y][x] === runColor) {
                runLen++;
            } else {
                if (runLen >= 5) penalty += 3 + (runLen - 5);
                runColor = modules[y][x];
                runLen = 1;
            }
        }
        if (runLen >= 5) penalty += 3 + (runLen - 5);
    }
    for (var x = 0; x < size; x++) {
        var runColor = modules[0][x];
        var runLen = 1;
        for (var y = 1; y < size; y++) {
            if (modules[y][x] === runColor) {
                runLen++;
            } else {
                if (runLen >= 5) penalty += 3 + (runLen - 5);
                runColor = modules[y][x];
                runLen = 1;
            }
        }
        if (runLen >= 5) penalty += 3 + (runLen - 5);
    }
    return penalty;
}

function qrPenaltyRule2(modules, size) {
    var penalty = 0;
    for (var y = 0; y < size - 1; y++) {
        for (var x = 0; x < size - 1; x++) {
            var c = modules[y][x];
            if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) {
                penalty += 3;
            }
        }
    }
    return penalty;
}

function qrRowMatchesPattern(cells, pattern) {
    for (var i = 0; i < pattern.length; i++) {
        if (cells[i] !== pattern[i]) return false;
    }
    return true;
}

function qrPenaltyRule3(modules, size) {
    var penalty = 0;
    var pat1 = [true, false, true, true, true, false, true, false, false, false, false];
    var pat2 = [false, false, false, false, true, false, true, true, true, false, true];
    var cells = new Array(11);

    for (var y = 0; y < size; y++) {
        for (var x = 0; x + 11 <= size; x++) {
            for (var k = 0; k < 11; k++) cells[k] = modules[y][x + k];
            if (qrRowMatchesPattern(cells, pat1)) penalty += 40;
            if (qrRowMatchesPattern(cells, pat2)) penalty += 40;
        }
    }
    for (var x = 0; x < size; x++) {
        for (var y = 0; y + 11 <= size; y++) {
            for (var k = 0; k < 11; k++) cells[k] = modules[y + k][x];
            if (qrRowMatchesPattern(cells, pat1)) penalty += 40;
            if (qrRowMatchesPattern(cells, pat2)) penalty += 40;
        }
    }
    return penalty;
}

function qrPenaltyRule4(modules, size) {
    var darkCount = 0;
    for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
            if (modules[y][x]) darkCount++;
        }
    }
    var percent = (darkCount * 100) / (size * size);
    var rating = Math.floor(Math.abs(percent - 50) / 5);
    return rating * 10;
}

function qrPenaltyScore(modules, size) {
    return (
        qrPenaltyRule1(modules, size) +
        qrPenaltyRule2(modules, size) +
        qrPenaltyRule3(modules, size) +
        qrPenaltyRule4(modules, size)
    );
}

// ---------------------------------------------------------------------------
// Codeword construction: bitstream -> data codewords -> interleaved codewords.
// ---------------------------------------------------------------------------

function qrBuildCodewords(version, dataBytes) {
    var blocks = qrGetBlocks(version);
    var capacityBits = qrCapacityBits(version);

    var bits = [];
    qrPutBits(bits, 4, 4); // mode indicator: byte mode = 0100
    qrPutBits(bits, dataBytes.length, qrCharCountBits(version));
    for (var i = 0; i < dataBytes.length; i++) {
        qrPutBits(bits, dataBytes[i], 8);
    }

    // Terminator: up to four 0 bits.
    var termCount = Math.min(capacityBits - bits.length, 4);
    for (var i = 0; i < termCount; i++) bits.push(0);

    // Pad to a byte boundary.
    var rem = bits.length % 8;
    if (rem !== 0) {
        for (var i = 0; i < 8 - rem; i++) bits.push(0);
    }

    // Pad with alternating 0xEC / 0x11 bytes until capacity is filled.
    var bytesToFill = (capacityBits - bits.length) / 8;
    for (var i = 0; i < bytesToFill; i++) {
        qrPutBits(bits, i % 2 === 0 ? 0xEC : 0x11, 8);
    }

    var dataCodewordsFull = qrBitsToBytes(bits);

    // Split into blocks, compute Reed-Solomon EC codewords per block.
    var offset = 0;
    var dcData = [];
    var ecData = [];
    var eccCount = blocks[0].ecc;
    var generator = qrRsGenerator(eccCount);
    var maxDc = 0;
    for (var b = 0; b < blocks.length; b++) {
        var dc = dataCodewordsFull.slice(offset, offset + blocks[b].data);
        offset += blocks[b].data;
        var ec = qrRsRemainder(dc, generator);
        dcData.push(dc);
        ecData.push(ec);
        if (dc.length > maxDc) maxDc = dc.length;
    }

    // Interleave data codewords, then interleave EC codewords.
    var out = [];
    for (var i = 0; i < maxDc; i++) {
        for (var b = 0; b < dcData.length; b++) {
            if (i < dcData[b].length) out.push(dcData[b][i]);
        }
    }
    for (var i = 0; i < eccCount; i++) {
        for (var b = 0; b < ecData.length; b++) {
            out.push(ecData[b][i]);
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

function qrEncode(text) {
    var dataBytes = qrUtf8Bytes(String(text));

    var version = -1;
    for (var v = 1; v <= 40; v++) {
        var neededBits = 4 + qrCharCountBits(v) + 8 * dataBytes.length;
        if (neededBits <= qrCapacityBits(v)) {
            version = v;
            break;
        }
    }
    if (version === -1) {
        throw new Error("qrEncode: data too long to fit in version 40-M (" + dataBytes.length + " bytes)");
    }

    var codewords = qrBuildCodewords(version, dataBytes);

    var bestMask = -1;
    var bestScore = 0;
    var bestResult = null;
    for (var m = 0; m < 8; m++) {
        var result = qrBuildMatrix(version, m, codewords);
        var score = qrPenaltyScore(result.modules, result.size);
        if (bestMask === -1 || score < bestScore) {
            bestScore = score;
            bestMask = m;
            bestResult = result;
        }
    }

    var size = bestResult.size;
    var modulesInt = new Array(size);
    for (var y = 0; y < size; y++) {
        modulesInt[y] = new Array(size);
        for (var x = 0; x < size; x++) {
            modulesInt[y][x] = bestResult.modules[y][x] ? 1 : 0;
        }
    }

    return { version: version, mask: bestMask, size: size, modules: modulesInt };
}

export { qrEncode };

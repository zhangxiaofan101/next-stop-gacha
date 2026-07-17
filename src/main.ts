// @ts-nocheck -- M37 逐字迁移自单文件 index.html，未加类型标注；M38 逻辑组件化迁移时拆分并补类型。
import { CN_MAP } from "./cn-map";
import "./style.css";

// ================= M37 数据外置 =================
// 目的地/线路数据不再注入本文件，而是由 tools/build.py 校验后发布到 public/data/
// 的静态 chunk（见 data/manifest.json 列出的固定顺序），运行时并行 fetch 后按该顺序
// 拼接，与旧版单文件构建时 `merged = sorted(...)` 产出的全局顺序等价——顺序影响
// filtered() 默认（未选排序方式时）的展示顺序，故拼接顺序不可用 fetch 完成顺序代替。
let DATA = [];
async function loadData() {
  // import.meta.env.BASE_URL（= vite.config.ts 的 base，"/next-stop-gacha/"）而非相对路径：
  // 相对路径在当前唯一入口下也能凑巧解析对，但显式用 Vite 的 base 常量不依赖调用时机/页面
  // URL 形状，与 F39 的教训一致——资产引用必须落在 Worker 路由前缀内，不能假设隐式解析。
  const base = import.meta.env.BASE_URL;
  const manifest = await fetch(`${base}data/manifest.json`).then(r => r.json());
  const chunks = await Promise.all(manifest.map(f => fetch(`${base}data/${f}`).then(r => r.json())));
  return chunks.flat();
}

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


/* ================= 配置 ================= */
const REGIONS = ["江浙沪", "华东", "华北", "东北", "华中", "华南", "西南", "西北", "港澳"];
const REGION_COLOR = {
  "江浙沪": "#cde9ff", "华东": "#cdeec9", "华北": "#ffe6b8", "东北": "#dce6ff",
  "华中": "#ffdcc9", "华南": "#ffd6e4", "西南": "#d2f0e0", "西北": "#f3e2c3", "港澳": "#e6dcff",
};
const SEASONS = ["春", "夏", "秋", "冬"];
const DAY_BUCKETS = [
  { key: "2", label: "2天", test: d => d.includes(2) },
  { key: "3", label: "3天", test: d => d.includes(3) },
  { key: "45", label: "4-5天", test: d => d.includes(4) || d.includes(5) },
  { key: "7", label: "1周", test: d => d.includes(7) },
  { key: "14", label: "2周+", test: d => d.includes(10) || d.includes(14) },
];
const CROWDS = ["热门", "适中", "小众"];
// 玩法 chip 列表：数据里仍保留「亲子」tag（搜索可命中），但 chip 不再展示——同行组「带娃」承载该场景（2026-07-14 用户拍板：UI 隐藏、数据保留）
const TAGS = ["美食", "博物馆", "古建筑", "古镇古村", "自然风光", "海岛海滨", "徒步", "民俗非遗", "citywalk", "夜生活", "温泉", "滑雪", "沙漠", "草原", "摄影出片", "世界遗产", "边境风情"];
const COMPANIONS = ["带娃", "带爸妈", "独行", "情侣周末"]; // 偏好型多选 OR；记录 companions 为空数组 = 谁来都合适（通配）
const CROWD_CLASS = { "热门": "hot", "适中": "mid", "小众": "hid" };
const EFFORTS = ["躺平", "正常", "费腿", "硬核"]; // 偏好型多选 OR；记录 effort 为空数组 = 怎么玩都行（通配）
const SH = { name: "上海", region: "江浙沪", coords: [31.23, 121.47] }; // region 供 M30 江浙沪自驾判定

/* ================= M23 天气预报（Open-Meteo，失败静默降级） ================= */
// WMO weather_code → {e: emoji, t: 简短中文}
const WX_CODE_MAP = {
  0: { e: "☀️", t: "晴" },
  1: { e: "🌤", t: "多云" }, 2: { e: "🌤", t: "多云" },
  3: { e: "☁️", t: "阴" },
  45: { e: "🌫", t: "雾" }, 48: { e: "🌫", t: "雾" },
  51: { e: "🌦", t: "毛毛雨" }, 53: { e: "🌦", t: "毛毛雨" }, 55: { e: "🌦", t: "毛毛雨" }, 56: { e: "🌦", t: "毛毛雨" }, 57: { e: "🌦", t: "毛毛雨" },
  61: { e: "🌧", t: "雨" }, 63: { e: "🌧", t: "雨" }, 65: { e: "🌧", t: "雨" }, 66: { e: "🌧", t: "雨" }, 67: { e: "🌧", t: "雨" },
  71: { e: "🌨", t: "雪" }, 73: { e: "🌨", t: "雪" }, 75: { e: "🌨", t: "雪" }, 77: { e: "🌨", t: "雪" },
  80: { e: "🌦", t: "阵雨" }, 81: { e: "🌦", t: "阵雨" }, 82: { e: "🌦", t: "阵雨" },
  85: { e: "🌨", t: "阵雪" }, 86: { e: "🌨", t: "阵雪" },
  95: { e: "⛈", t: "雷雨" }, 96: { e: "⛈", t: "雷雨" }, 99: { e: "⛈", t: "雷雨" },
};
const wxInfo = code => WX_CODE_MAP[code] || { e: "🌡", t: "未知" };
const wxLine = days => days.map(x => `${wxInfo(x.code).e}${x.hi}°`).join(" "); // 逐日 emoji+最高温压缩成一行

const WX_LS_KEY = "nextstop_wx_v1";
const WX_TTL = 3 * 60 * 60 * 1000; // 缓存 3 小时内直接复用，减少请求
function wxCacheRead() {
  try { return JSON.parse(localStorage.getItem(WX_LS_KEY) || "{}"); } catch (e) { return {}; }
}
function wxCacheWrite(cache) {
  try {
    const keys = Object.keys(cache);
    if (keys.length > 60) keys.sort((a, b) => cache[a].t - cache[b].t).slice(0, keys.length - 60).forEach(k => delete cache[k]);
    localStorage.setItem(WX_LS_KEY, JSON.stringify(cache));
  } catch (e) {}
}
// 同步读缓存（仅 TTL 内命中才返回），供路书文本导出等不发请求的场景用
function wxCacheGet(id) {
  const hit = wxCacheRead()[id];
  return (hit && Date.now() - hit.t < WX_TTL) ? hit.days : null;
}
// 拉 7 天预报；任何失败（超时/断网/非200/解析错）都只 console.warn 后返回 null，绝不抛错影响页面其他功能
async function fetchWeather(d) {
  const cached = wxCacheGet(d.id);
  if (cached) return cached;
  const coords = (d.stops && d.stops.length ? byId(d.stops[0].id)?.coords : d.coords) || null; // 线路卡取首站坐标，代表起点站
  if (!coords) return null;
  const [lat, lng] = coords;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=7`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const days = j.daily.time.map((dt, i) => ({
      dt, code: j.daily.weather_code[i],
      hi: Math.round(j.daily.temperature_2m_max[i]), lo: Math.round(j.daily.temperature_2m_min[i]),
    }));
    const cache = wxCacheRead();
    cache[d.id] = { t: Date.now(), days };
    wxCacheWrite(cache);
    return days;
  } catch (e) {
    console.warn("天气预报获取失败：", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
const PER_DAY_COST = { "¥": 380, "¥¥": 680, "¥¥¥": 1150 };
// 序数·容忍型筛选：点一档=天花板，自动含更省/更易达的所有低档（花费、抵达难度）。
// 偏好型筛选（体力/冷热/地区/季节）不在此，走纯多选 OR。值按 低→高 排列。
const CEIL_GROUPS = { cost: ["¥", "¥¥", "¥¥¥"], difficulty: ["直达", "一次中转", "折腾"] };

const now = new Date();
const CUR_SEASON = ["冬", "冬", "春", "春", "春", "夏", "夏", "夏", "秋", "秋", "秋", "冬"][now.getMonth()];

const state = {
  region: new Set(), season: new Set(), days: new Set(),
  crowd: new Set(), cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(), tags: new Set(), q: "", sort: "default", onlyFav: false, noAlt: false, hideVisited: false,
  favs: [], cmp: [], trip: [], // trip: [{id, days}]
  visited: [], // 已打卡的城市 id
  tripStart: "", // M29 出发日期（"YYYY-MM-DD"，空=不标日期，路书退回 D1/D2 记法）
};

/* ================= 本地存储 ================= */
const LS_KEY = "nextstop_v2";
function saveLS() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ favs: state.favs, cmp: state.cmp, trip: state.trip, visited: state.visited, tripStart: state.tripStart })); } catch (e) {}
}
function loadLS() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const ids = new Set(DATA.map(d => d.id));
    const cityIds = new Set(DATA.filter(d => !d.stops).map(d => d.id));
    state.favs = (s.favs || []).filter(id => ids.has(id));
    state.cmp = (s.cmp || []).filter(id => ids.has(id));
    // F14：trip 只认城市 id——旧版顺路彩蛋可能把线路 id 持久化成单站，升级加载时挡掉；天数也一并校验
    state.trip = (s.trip || []).filter(t => t && cityIds.has(t.id) && Number.isInteger(t.days) && t.days >= 1 && t.days <= 14);
    // F18：旧版把线路装入标记持久化为 r:1（线路 id 已丢失，无法安全重建原线路）。降级迁移=去掉失效的 r
    // 变回独立城市站，并把天数夹到该城市的合法方案档，避免继续吐「按 N 天版改编」（如旧独库 yili:2→5）。
    const routeIds = new Set(DATA.filter(d => d.stops).map(d => d.id));
    state.trip.forEach(t => {
      if (t.r && !routeIds.has(t.r)) {
        delete t.r;
        const c = byId(t.id);
        if (c && !c.days.includes(t.days)) t.days = Math.min(...c.days);
      }
    });
    // F13：visited 只认城市 id——schema 内合法但业务非法的线路 id 也要挡掉，并顺手去重
    state.visited = [...new Set((s.visited || []).filter(id => cityIds.has(id)))];
    state.tripStart = /^\d{4}-\d{2}-\d{2}$/.test(s.tripStart || "") ? s.tripStart : "";
  } catch (e) {}
}

/* ================= 小工具 ================= */
const byId = id => DATA.find(x => x.id === id);
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = "none", 1800);
}
function havRaw(a, b) { // 不取整版：几何计算（绕路增量差值）必须用它，取整会破坏三角不等式（F17）
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b[0] - a[0]), dLng = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const hav = (a, b) => Math.round(havRaw(a, b));
const FLY_PROV = new Set(["西藏", "新疆", "海南", "香港", "澳门"]);
// 渤海湾/胶东半岛：铁路大幅绕行（青岛真实 6h vs 直线估 3h），超 500km 的段倾向飞。
// 只对真跨海方向生效（codex F10），按对端方位判定，同侧陆路走廊不强制飞：
//  · 大连：除东北三省（哈大/沈白直达）外，其余方向直线均跨渤海/黄海
//  · 胶东三市南向：纬度<34.5 且经度>118（江浙沪及以南沿海）跨黄海；西/西南内陆（徐州、郑洛、石家庄）走陆路
//  · 胶东三市北向：东北三省跨渤海海峡；烟台/威海位置近海角，北纬>38.8（京/承/大同一线）即跨渤海湾；
//    青岛偏南基部，西北扇面（北京/正定）有陆路直达，仅东北向（承德/坝上，纬>39.5 且经>117.4）跨湾
const SD_PEN = new Set(["qingdao", "yantai", "weihai"]);
const NE_PROV = new Set(["辽宁", "吉林", "黑龙江"]);
function seaDetour(p, q) {
  const [lat, lng] = q.coords;
  if (p.id === "dalian") return !NE_PROV.has(q.province);
  if (!SD_PEN.has(p.id)) return false;
  if (lat < 34.5 && lng > 118) return true;
  if (NE_PROV.has(q.province)) return true;
  if (p.id === "qingdao") return lat > 39.5 && lng > 117.4;
  return lat > 38.8;
}
// 时长参数以 245 条 transit 人写时长回归标定（2026-07-14）：高铁=直线km/190+0.6，
// 飞机=直线km/625+2.4（口径为门到门、含机场地面时间）；干线快/沿海支线慢的残差是直线模型固有的，输出恒标"估算"
// 显式交通语义（F30）：leg 只承诺逐日文案与住宿，不代表陆路；游轮/轮渡/火车段用 stop.leg.transport 直接指定，
// 避免 F29 的 overland 把非公路 leg（如三峡游轮）也标成自驾。
const TRANSPORT_META = { "游轮": { icon: "🚢", kmph: 26 }, "轮渡": { icon: "⛴", kmph: 24 }, "火车": { icon: "🚄", kmph: 120 } };
// overland=true：该段是同一条完整 leg 组内的相邻站（招牌自驾/包车线，如 G318、阿里、沙漠公路），
// 两站再远也是陆路翻山穿沙，不存在航班——此时禁用「飞机」判定，落包车/自驾（中途过夜由 leg.stays 承载）。
function legInfo(a, b, overland, transport) {
  const km = hav(a.coords, b.coords);
  const straight = Math.round(km * 1.25); // 近似实际里程
  if (transport && TRANSPORT_META[transport]) { // 显式模式优先于距离启发式
    const t = TRANSPORT_META[transport];
    return { km: straight, mode: transport, icon: t.icon, hours: Math.round(km / t.kmph * 10) / 10 };
  }
  const provFly = FLY_PROV.has(a.province) || FLY_PROV.has(b.province);
  const needFly = provFly || (km >= 500 && (seaDetour(a, b) || seaDetour(b, a)));
  // M30：两端都在江浙沪的段（上海计入江浙沪），160~400km 也标自驾并列——用户自驾圈
  const jzh = a.region === "江浙沪" && b.region === "江浙沪";
  let mode, icon, hours;
  if (km < 60) { mode = "打车/自驾"; icon = "🚕"; hours = Math.max(.6, km / 50); }
  // overland：同一条完整 leg 组内的相邻站（招牌自驾/包车线），60km 以上一律陆路，不判高铁/飞机
  else if (overland) { mode = "包车/自驾"; icon = "🚐"; hours = km / 55; }
  else if (km < 160 && !needFly) { mode = "高铁/自驾"; icon = "🚄"; hours = km / 160 + .4; }
  else if (km < 950 && !needFly) { mode = jzh && km < 400 ? "高铁/自驾" : "高铁"; icon = "🚄"; hours = km / 190 + .6; }
  else if (provFly && km < 400) { mode = "包车/大巴"; icon = "🚐"; hours = km / 55; }
  else { mode = "飞机"; icon = "✈️"; hours = km / 625 + 2.4; }
  return { km: straight, mode, icon, hours: Math.round(hours * 10) / 10 };
}
const fmtH = h => h >= 1 ? `约${h}h` : `约${Math.round(h * 60)}分钟`;
// 玩法节奏小清单：路线型目的地（玩法主体=沿线移动、按晚换落脚点），路书住宿建议按段订房。
// 从严收录——单基地+一晚特色住宿（林芝/神农架/漠河）与双基地（乐山峨眉/晋东南）不算路线型。
const ROUTE_STAY = new Set(["chuanxi-loop", "hulunbuir", "gannan", "yili", "siguniangshan-danba", "altay"]); // M31：独库/青海湖环线已迁线路卡
// 线路天数展示（F8）：days 枚举=有对应 plan 支撑的弹性档位，Σstops=默认装入分配；名称不带日数（build 强制）
function routeDaysText(d) {
  const sum = d.stops.reduce((s, x) => s + x.days, 0);
  const lo = Math.min(...d.days), hi = Math.max(...d.days);
  return lo === hi ? `约${lo}天` : `约${lo}~${hi}天 · 默认${sum}天`;
}

/* ================= 筛选面板 ================= */
function buildConsole() {
  const el = document.getElementById("console");
  const group = (label, key, items, valFn = v => v) => `
    <div class="fgroup">
      <div class="flabel">${label}</div>
      <div class="chips" data-key="${key}">
        ${items.map(it => `<button class="chip" data-v="${valFn(it)}">${typeof it === "string" ? it : it.label}</button>`).join("")}
      </div>
    </div>`;
  el.innerHTML =
    group("地区", "region", REGIONS) +
    group("季节", "season", SEASONS) +
    group("天数", "days", DAY_BUCKETS, b => b.key) +
    group("冷热", "crowd", CROWDS) +
    group("花费", "cost", [{ label: "¥ 经济", v: "¥" }, { label: "¥¥ 适中", v: "¥¥" }, { label: "¥¥¥ 舍得花", v: "¥¥¥" }], c => c.v) +
    group("抵达难度", "difficulty", CEIL_GROUPS.difficulty) +
    group("体力", "effort", EFFORTS) +
    group("同行", "companions", COMPANIONS) +
    group("玩法", "tags", TAGS) +
    `<div class="console-foot">
      <input class="search" id="searchBox" type="search" placeholder="搜城市 / 美食 / 关键词，比如「牛肉火锅」「石窟」…">
      <select class="sort" id="sortSel">
        <option value="default">推荐顺序</option>
        <option value="season">当季优先</option>
        <option value="hidden">小众优先</option>
        <option value="hot">热门优先</option>
        <option value="short">天数短 → 长</option>
      </select>
      <button class="btn" id="altToggle">⛰️ 避开高海拔</button>
      <button class="btn" id="favToggle">♥ 只看收藏</button>
      <button class="btn" id="visitedToggle">👣 隐藏去过的</button>
      <button class="btn" id="mapBtn">🗺 足迹地图</button>
      <button class="btn" id="shareBtn">📤 分享/备份</button>
      <button class="btn" id="resetConsoleBtn">清空筛选</button>
      <div class="hit" id="hitCount"></div>
    </div>`;

  el.querySelectorAll(".chips").forEach(box => {
    box.addEventListener("click", e => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      const key = box.dataset.key;
      const set = state[key];
      const v = btn.dataset.v;
      const order = CEIL_GROUPS[key];
      if (order) {
        // 天花板型：点第 t 档 → 选中 0..t 全部；再点当前天花板则清空
        const t = order.indexOf(v);
        const curCeil = set.size ? Math.max(...[...set].map(x => order.indexOf(x))) : -1;
        set.clear();
        if (curCeil !== t) order.slice(0, t + 1).forEach(x => set.add(x));
      } else {
        set.has(v) ? set.delete(v) : set.add(v);
      }
      box.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", set.has(c.dataset.v)));
      render();
    });
  });
  document.getElementById("searchBox").addEventListener("input", e => { state.q = e.target.value.trim(); render(); });
  document.getElementById("sortSel").addEventListener("change", e => { state.sort = e.target.value; render(); });
  document.getElementById("favToggle").addEventListener("click", e => {
    state.onlyFav = !state.onlyFav;
    e.target.classList.toggle("on", state.onlyFav);
    render();
  });
  document.getElementById("altToggle").addEventListener("click", e => {
    state.noAlt = !state.noAlt;
    e.target.classList.toggle("on", state.noAlt);
    render();
  });
  document.getElementById("visitedToggle").addEventListener("click", e => {
    state.hideVisited = !state.hideVisited;
    e.target.classList.toggle("on", state.hideVisited);
    render();
  });
  document.getElementById("mapBtn").addEventListener("click", openMap);
  document.getElementById("shareBtn").addEventListener("click", openShare);
  // F40：module 化后顶层函数不再落到 window，inline onclick="resetFilters()" 会报
  // ReferenceError——两处清空按钮改走 addEventListener，与本函数其余按钮一致
  document.getElementById("resetConsoleBtn").addEventListener("click", resetFilters);
}

function resetFilters() {
  ["region", "season", "days", "crowd", "cost", "difficulty", "effort", "companions", "tags"].forEach(k => state[k].clear());
  state.q = ""; state.onlyFav = false; state.noAlt = false; state.hideVisited = false;
  document.getElementById("searchBox").value = "";
  document.getElementById("favToggle").classList.remove("on");
  document.getElementById("altToggle").classList.remove("on");
  document.getElementById("visitedToggle").classList.remove("on");
  document.querySelectorAll(".chip.on").forEach(c => c.classList.remove("on"));
  render();
}

/* ================= 过滤 & 排序 ================= */
// 单条记录是否命中；okey/oset 可临时覆盖某一组条件（okey="q"/"onlyFav"/"noAlt" 时表示清掉该项），
// 供 chip 实时计数与空态定向放宽做"如果改这一个条件会怎样"的假设计算。
function matchOne(d, okey, oset) {
  const g = k => (k === okey ? oset : state[k]);
  const q = okey === "q" ? "" : state.q;
  const fav = okey === "onlyFav" ? false : state.onlyFav;
  const noAlt = okey === "noAlt" ? false : state.noAlt;
  const hideV = okey === "hideVisited" ? false : state.hideVisited;
  if (fav && !state.favs.includes(d.id)) return false;
  if (noAlt && d.alt) return false;
  if (hideV && state.visited.includes(d.id)) return false;
  if (g("region").size && !(d.regions || [d.region]).some(r => g("region").has(r))) return false;
  if (g("season").size && !d.seasons.some(s => g("season").has(s))) return false;
  if (g("days").size && !DAY_BUCKETS.some(b => g("days").has(b.key) && b.test(d.days))) return false;
  if (g("crowd").size && !g("crowd").has(d.crowd)) return false;
  if (g("cost").size && !g("cost").has(d.cost)) return false;
  if (g("difficulty").size && !g("difficulty").has(d.difficulty)) return false;
  // 体力：偏好型多选 OR；记录 effort 为空数组 = 怎么玩都行，任何选择都命中
  if (g("effort").size && d.effort.length && !d.effort.some(x => g("effort").has(x))) return false;
  // 同行：同上口径，空数组 = 谁来都合适
  if (g("companions").size && d.companions.length && !d.companions.some(x => g("companions").has(x))) return false;
  if (g("tags").size && ![...g("tags")].every(t => d.tags.includes(t))) return false;
  if (q) {
    const hay = [d.name, d.province, d.tagline, ...d.tags, ...d.food, ...d.highlights, ...d.architecture, ...d.museums].join(" ").toLowerCase();
    if (!hay.includes(q.toLowerCase())) return false;
  }
  return true;
}
const countWith = (okey, oset) => DATA.reduce((n, d) => n + matchOne(d, okey, oset), 0);

// 模拟点击某 chip 后该组的选中集（与真实点击逻辑一致：天花板组填充 {0..t}，其余 toggle）
function simulateClick(key, v) {
  const cur = state[key];
  const next = new Set(cur);
  const order = CEIL_GROUPS[key];
  if (order) {
    const t = order.indexOf(v);
    const curCeil = cur.size ? Math.max(...[...cur].map(x => order.indexOf(x))) : -1;
    next.clear();
    if (curCeil !== t) order.slice(0, t + 1).forEach(x => next.add(x));
  } else {
    next.has(v) ? next.delete(v) : next.add(v);
  }
  return next;
}

// 每个未选 chip 标注"点下去还剩几个"，0 置灰；已选 chip 不标（点它是取消）
function updateChipCounts() {
  document.querySelectorAll("#console .chips").forEach(box => {
    const key = box.dataset.key;
    box.querySelectorAll(".chip").forEach(btn => {
      const v = btn.dataset.v;
      const on = state[key].has(v);
      const n = on ? -1 : countWith(key, simulateClick(key, v));
      let i = btn.querySelector("i");
      if (!i) { i = document.createElement("i"); btn.appendChild(i); }
      i.textContent = on ? "" : String(n);
      btn.classList.toggle("zero", !on && n === 0);
    });
  });
}

function syncChips() {
  document.querySelectorAll("#console .chips").forEach(box => {
    const set = state[box.dataset.key];
    box.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", set.has(c.dataset.v)));
  });
}

// 空池时的定向放宽候选：去掉单个玩法 tag / 放开整组 / 清搜索词 / 关只看收藏，按救回数降序
const GROUP_NAMES = { region: "地区", season: "季节", days: "天数", crowd: "冷热", cost: "花费", difficulty: "抵达难度", effort: "体力", companions: "同行" };
let relaxCands = [];
function relaxCandidates() {
  const cands = [];
  [...state.tags].forEach(t => {
    const s = new Set(state.tags); s.delete(t);
    cands.push({ label: `去掉「${t}」`, n: countWith("tags", s), apply: () => state.tags.delete(t) });
  });
  Object.keys(GROUP_NAMES).forEach(k => {
    if (state[k].size) cands.push({ label: `不限${GROUP_NAMES[k]}`, n: countWith(k, new Set()), apply: () => state[k].clear() });
  });
  if (state.q) cands.push({
    label: `清掉搜索「${state.q}」`, n: countWith("q", null),
    apply: () => { state.q = ""; document.getElementById("searchBox").value = ""; },
  });
  if (state.onlyFav) cands.push({
    label: "不只看收藏", n: countWith("onlyFav", null),
    apply: () => { state.onlyFav = false; document.getElementById("favToggle").classList.remove("on"); },
  });
  if (state.noAlt) cands.push({
    label: "不避开高海拔", n: countWith("noAlt", null),
    apply: () => { state.noAlt = false; document.getElementById("altToggle").classList.remove("on"); },
  });
  if (state.hideVisited) cands.push({
    label: "不隐藏去过的", n: countWith("hideVisited", null),
    apply: () => { state.hideVisited = false; document.getElementById("visitedToggle").classList.remove("on"); },
  });
  return cands.filter(c => c.n > 0).sort((a, b) => b.n - a.n);
}
function applyRelax(i) {
  const c = relaxCands[i];
  if (!c) return;
  c.apply(); syncChips(); render();
}

function filtered() {
  let list = DATA.filter(d => matchOne(d, null, null));
  const crowdRank = { "小众": 0, "适中": 1, "热门": 2 };
  if (state.sort === "hidden") list = [...list].sort((a, b) => crowdRank[a.crowd] - crowdRank[b.crowd]);
  if (state.sort === "hot") list = [...list].sort((a, b) => crowdRank[b.crowd] - crowdRank[a.crowd]);
  if (state.sort === "short") list = [...list].sort((a, b) => Math.min(...a.days) - Math.min(...b.days));
  if (state.sort === "season") list = [...list].sort((a, b) => b.seasons.includes(CUR_SEASON) - a.seasons.includes(CUR_SEASON));
  return list;
}

/* ================= 卡片渲染 ================= */
const seasonsHTML = d => `<span class="seasons">${SEASONS.map(s =>
  `<span class="s-dot s${s} ${d.seasons.includes(s) ? "" : "off"}">${s}</span>`).join("")}</span>`;

function cardHTML(d, i) {
  const rs = REGION_COLOR[d.region] || "#cde9ff";
  const isRoute = !!d.stops;
  const routeLine = isRoute ? d.stops.map(s => byId(s.id)?.name || s.id).join(" → ") : "";
  const tripBtn = isRoute
    ? `<button class="act trip" data-addroute="${d.id}">🎫 整条装入</button>`
    : `<button class="act trip ${state.trip.some(t => t.id === d.id) ? "on" : ""}" data-trip="${d.id}">🧳 行程</button>`;
  return `
  <article class="card ${isRoute ? "route-card" : ""}" data-id="${d.id}" style="--rs:${rs}; --rc:${rs}; animation-delay:${Math.min(i * 25, 350)}ms">
    <div class="c-strip">
      <span class="c-route">${isRoute ? `🎫 联程线路 · ${d.province}` : `上海 ✈ ${d.province} · ${d.region}`}</span>
      <span class="c-badges">
        ${!isRoute && state.visited.includes(d.id) ? `<span class="badge visitedb">✓ 去过</span>` : ""}
        ${isRoute ? `<span class="badge routeb">线路卡</span>` : ""}
        ${d.seasons.includes(CUR_SEASON) ? `<span class="badge now">当季</span>` : ""}
        ${d.alt ? `<span class="badge altb">⛰️ 高海拔</span>` : ""}
        <span class="badge ${CROWD_CLASS[d.crowd]}">${d.crowd}</span>
      </span>
    </div>
    <div class="c-body">
      <div class="c-name-row">
        <span class="c-emoji">${d.emoji}</span>
        <span>
          <span class="c-name">${d.name}</span>
          <div class="c-prov">${isRoute ? routeLine : `${d.province} · ${d.cost} · 🚄 ${d.transit}（${d.difficulty}）`}</div>
        </span>
      </div>
      <div class="c-tagline">${d.tagline}</div>
      <div class="c-meta">
        ${seasonsHTML(d)}
        <span>📅 ${d.stops ? routeDaysText(d) : d.days.join("/") + "天"}</span>
      </div>
      <div class="c-tags">${d.tags.map(t => `<span class="mini-tag">${t}</span>`).join("")}</div>
      <div class="c-actions">
        <button class="act fav ${state.favs.includes(d.id) ? "on" : ""}" data-fav="${d.id}">♥ 收藏</button>
        <button class="act cmp ${state.cmp.includes(d.id) ? "on" : ""}" data-cmp="${d.id}">⚖️ 对比</button>
        ${tripBtn}
      </div>
    </div>
  </article>`;
}

function render() {
  const list = filtered();
  document.getElementById("grid").innerHTML = list.map(cardHTML).join("");
  document.getElementById("empty").style.display = list.length ? "none" : "block";
  document.getElementById("hitCount").textContent = `命中 ${list.length} / ${DATA.length}`;
  if (!list.length) {
    relaxCands = relaxCandidates();
    document.getElementById("relaxBox").innerHTML = relaxCands.slice(0, 3).map((c, i) =>
      `<button class="btn relax" data-relax="${i}">${c.label} → 能救回 ${c.n} 个</button>`).join("");
  }
  updateChipCounts();
  renderDock();
  updateFootprint();
}
// 足迹统计：打卡数 + 点亮省份数（只算城市记录，线路卡不计入 visited）
// F11：点亮省份唯一口径——CN_MAP 省短名被任一 visited 城市的 province 字符串 includes 即点亮
// （跨省交界记录如泸沽湖「云南·四川交界」点亮两省）；地图填色、地图统计条、足迹胶囊三处同源
function litProvinces() {
  const vs = state.visited.map(byId).filter(Boolean);
  return CN_MAP.prov.filter(p => vs.some(d => (d.province || "").includes(p.n))).map(p => p.n);
}
function updateFootprint() {
  const pill = document.getElementById("footPill");
  const n = state.visited.length;
  if (!n) { pill.style.display = "none"; return; }
  pill.textContent = `👣 去过 ${n} 个目的地 · 点亮 ${litProvinces().length} 个省份`;
  pill.style.display = "";
}

/* ================= 收藏 / 对比 / 行程 篮子 ================= */
function toggleFav(id) {
  const i = state.favs.indexOf(id);
  i >= 0 ? state.favs.splice(i, 1) : state.favs.push(id);
  saveLS(); render();
  if (document.getElementById("mapOverlay").classList.contains("show")) renderMap();
}
function toggleVisited(id) {
  const i = state.visited.indexOf(id);
  if (i >= 0) { state.visited.splice(i, 1); toast("已取消打卡"); }
  else { state.visited.push(id); toast(`👣 已打卡：${byId(id).name}`); }
  saveLS(); render();
  if (document.getElementById("mapOverlay").classList.contains("show")) renderMap();
}
function toggleCmp(id) {
  const i = state.cmp.indexOf(id);
  if (i >= 0) state.cmp.splice(i, 1);
  else {
    if (state.cmp.length >= 4) { toast("最多对比 4 个哦"); return; }
    state.cmp.push(id);
  }
  saveLS(); render();
}
function toggleTrip(id) {
  const i = state.trip.findIndex(t => t.id === id);
  if (i >= 0) state.trip.splice(i, 1);
  else {
    if (state.trip.length >= 6) { toast("一次行程最多 6 站，贪多嚼不烂～"); return; }
    const d = byId(id);
    state.trip.push({ id, days: Math.min(...d.days) });
    toast(`已加入行程：${d.name}`);
  }
  saveLS(); render();
}
// M18 线路卡：把 stops 逐条展开装入行程单（复用既有路书管线，不改行程/路书任何逻辑）
function addRouteToTrip(routeId) {
  const route = byId(routeId); if (!route || !route.stops) return;
  let added = 0, skippedFull = false;
  for (const s of route.stops) {
    if (state.trip.some(t => t.id === s.id)) continue;
    if (state.trip.length >= 6) { skippedFull = true; break; }
    state.trip.push({ id: s.id, days: s.days, r: routeId }); // r=线路 id：既是装入标记（下拉放开 1~城市上限），也让路书回查该线路 stop 的专属逐日文案（F18）
    added++;
  }
  saveLS(); render();
  if (added === 0) toast(skippedFull ? "行程已满，一站都没装进去" : "这条线路的站点都已在行程里啦");
  else if (skippedFull) toast(`行程已满 6 站，只装入了前 ${added} 站`);
  else toast(`已把「${route.name}」整条装入行程（${added} 站）`);
}

// dock 有内容才显示（2026-07-14 用户真机使用后否决空态常驻方案，回退隐藏；显示时奶油底色与白色页面区分）
function renderDock() {
  const hasCmp = state.cmp.length > 0, hasTrip = state.trip.length > 0;
  document.getElementById("dock").classList.toggle("show", hasCmp || hasTrip);
  document.getElementById("cmpBox").style.display = hasCmp ? "flex" : "none";
  document.getElementById("tripBox").style.display = hasTrip ? "flex" : "none";
  document.getElementById("cmpItems").innerHTML = state.cmp.map(id => {
    const d = byId(id); return `<button class="dock-chip" data-rmcmp="${id}" aria-label="从对比中移除${d.name}">${d.emoji}${d.name} ✕</button>`;
  }).join("");
  document.getElementById("tripItems").innerHTML = state.trip.map(t => {
    const d = byId(t.id); return `<button class="dock-chip" data-rmtrip="${t.id}" aria-label="从行程中移除${d.name}">${d.emoji}${d.name} ✕</button>`;
  }).join("");
}

/* ================= 详情 ================= */
function detailHTML(d) {
  const sec = (title, inner) => inner ? `<div class="dt-sec"><h3>${title}</h3>${inner}</div>` : "";
  const chips = (arr, cls = "") => arr.length ? `<div class="dt-chips">${arr.map(x => `<span class="dt-chip ${cls}">${x}</span>`).join("")}</div>` : "";
  const rs = REGION_COLOR[d.region] || "#cde9ff";
  const isRoute = !!d.stops;
  const inTrip = state.trip.some(t => t.id === d.id);
  const tripBtn = isRoute
    ? `<button class="big-btn" data-addroute="${d.id}">🎫 整条装入行程单</button>`
    : `<button class="big-btn ${inTrip ? "ghost" : ""}" data-trip="${d.id}">${inTrip ? "已在行程 ✓（点击移除）" : "🧳 加入行程"}</button>`;
  const isVisited = state.visited.includes(d.id);
  // 打卡去过：只有城市记录才有意义，线路卡按站点/城市算，不给这个按钮
  const visitBtn = isRoute ? "" : `<button class="big-btn ${isVisited ? "ghost" : "green"}" data-visited="${d.id}">${isVisited ? "✓ 去过了（点击取消）" : "👣 打卡去过"}</button>`;
  return `
    <div class="dt-head">
      <span class="c-emoji dt-emoji" style="--rs:${rs};background:${rs}">${d.emoji}</span>
      <div>
        <h2 class="dt-name">${d.name}</h2>
        <div class="dt-sub">${isRoute ? `🎫 联程线路 · ${d.province}` : `${d.province} · ${d.region} · ${d.crowd} · ${d.cost}`}</div>
      </div>
    </div>
    <div class="dt-tagline">${d.tagline}</div>
    ${isRoute ? sec("🗺 途经站点", `<ol class="dt-list">${d.stops.map(s => {
      const city = byId(s.id); return `<li>${city ? `${city.emoji} ${city.name}` : s.id} · 建议 ${s.days} 天</li>`;
    }).join("")}</ol>`) : ""}
    <div class="dt-meta">
      ${seasonsHTML(d)}
      <span>📅 ${d.stops ? `${routeDaysText(d)}（各站天数装入行程单后可调）` : `建议 ${d.days.join(" / ")} 天`}</span>
      <span>🚄 ${d.transit}（${d.difficulty}）</span>
      <span>🥾 ${d.effort.length ? d.effort.join(" / ") : "怎么玩都行"}</span>
      <span>👥 ${d.companions.length ? d.companions.join(" / ") : "谁来都合适"}</span>
    </div>
    <div class="dt-meta"><span>🌤 ${d.seasonNote}</span></div>
    ${d.alt ? `<div class="dt-meta"><span>⛰️ 主要游玩区海拔 2500m+，注意高原反应，头两天慢一点</span></div>` : ""}
    ${sec("🍜 当地美食", chips(d.food, "food"))}
    ${sec("🏛 博物馆", chips(d.museums))}
    ${sec("🏯 古建古迹", chips(d.architecture))}
    ${sec("✨ 特色体验", d.highlights.length ? `<ul class="dt-list">${d.highlights.map(h => `<li>${h}</li>`).join("")}</ul>` : "")}
    <div id="wxSec"></div>
    ${sec("🏨 住宿参考", d.hotel ? `<div class="note-box hotel">${d.hotel}</div>` : "")}
    ${sec("🚌 当地交通", d.local ? `<div class="note-box">${d.local}</div>` : "")}
    ${sec("🗓 行程方案", d.plans.map(p => `
      <div class="plan">
        <span class="plan-days">${p.days}天</span>
        <div><div class="plan-title">${p.title}</div><div class="plan-route">${p.route}</div></div>
      </div>`).join(""))}
    <div class="dt-actrow">
      ${tripBtn}
      <button class="big-btn blue" data-cmp="${d.id}">⚖️ 加入对比</button>
      ${visitBtn}
    </div>`;
}

function openDetail(id) {
  const d = byId(id); if (!d) return;
  document.getElementById("detailBody").innerHTML = detailHTML(d);
  document.getElementById("detailOverlay").classList.add("show");
  fillDetailWeather(d);
}
// 详情页 7 天预报：异步填充，用 data-id 核对——避免用户快速换卡片时把旧请求的结果写串
async function fillDetailWeather(d) {
  const box = document.getElementById("wxSec");
  if (!box) return;
  box.dataset.id = d.id;
  const days = await fetchWeather(d);
  if (!days || box.dataset.id !== d.id) return;
  const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const startOfDay = t => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const todayTs = startOfDay(new Date());
  const cells = days.map(x => {
    const [y, m, dd] = x.dt.split("-").map(Number);
    const dt = new Date(y, m - 1, dd);
    const diff = Math.round((startOfDay(dt) - todayTs) / 86400000);
    const label = diff === 0 ? "今天" : diff === 1 ? "明天" : WEEK[dt.getDay()];
    const info = wxInfo(x.code);
    return `<div class="wx-day"><div>${label}</div><div>${info.e}</div><div>${x.hi}°/${x.lo}°</div></div>`;
  }).join("");
  box.innerHTML = `<div class="dt-sec"><h3>⛅ 未来 7 天${d.stops ? " · 起点站" : ""}</h3><div class="wx-row">${cells}</div><div class="wx-note">数据 <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>（<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> · 经本站整理换算）· 出发前以天气 App 为准</div></div>`;
}

/* ================= 对比 ================= */
function openCompare() {
  const ds = state.cmp.map(byId);
  if (ds.length < 2) { toast("至少选 2 个再比嘛"); return; }
  const row = (label, fn) => `<tr><th class="rowh">${label}</th>${ds.map(d => `<td>${fn(d)}</td>`).join("")}</tr>`;
  document.getElementById("cmpTableWrap").innerHTML = `
  <table class="cmp">
    <tr><th class="rowh">目的地</th>${ds.map(d => `<td class="cityh">${d.emoji} ${d.name}<br><span class="sm">${d.province} · ${d.region}</span></td>`).join("")}</tr>
    ${row("一句话", d => d.tagline)}
    ${row("冷热 / 花费", d => `${d.crowd} · ${d.cost}`)}
    ${row("体力", d => (d.effort.length ? d.effort.join("、") : "怎么玩都行") + (d.alt ? " · ⛰️ 高海拔" : ""))}
    ${row("同行", d => d.companions.length ? d.companions.join("、") : "谁来都合适")}
    ${row("最佳季节", d => d.seasons.join("、") + `<br><span class="sm">${d.seasonNote}</span>`)}
    ${row("建议天数", d => d.days.join(" / ") + " 天")}
    ${row("交通", d => `${d.transit}（${d.difficulty}）`)}
    ${row("美食", d => d.food.join("、"))}
    ${row("博物馆", d => d.museums.join("、") || "—")}
    ${row("古建古迹", d => d.architecture.join("、") || "—")}
    ${row("住宿", d => d.hotel || "—")}
    ${row("特色体验", d => d.highlights.map(h => "· " + h).join("<br>"))}
    ${row("方案", d => d.plans.map(p => `<b>${p.days}天 ${p.title}</b>：${p.route}`).join("<br>"))}
  </table>`;
  document.getElementById("cmpOverlay").classList.add("show");
}

/* ================= 足迹地图 ================= */
// 零依赖 SVG 中国地图：CN_MAP（tools/make_footprint_map.py 离线生成，见该行上方注入的 const CN_MAP）
// 撒点投影务必和 CN_MAP.prj 公式一致：x=(lng-lng0)*kx, y=(lat1-lat)*ky（注意 coords=[lat,lng] 顺序）
function openMap() {
  renderMap();
  document.getElementById("mapOverlay").classList.add("show");
}
function renderMap() {
  const visited = state.visited.map(byId).filter(Boolean); // state.visited 只存城市 id
  const lit = litProvinces(); // F11：与填色/足迹胶囊同一口径
  const statHTML = visited.length
    ? `<div class="map-stat">👣 去过 ${visited.length} 个目的地 · 点亮 ${lit.length} 个省份 · ♥ 收藏 ${state.favs.length}</div>`
    : `<div class="map-empty">还没打卡过——去任意目的地详情页点『👣 打卡去过』，地图就会亮起来</div>`;
  const litSet = new Set(lit);
  const provPaths = CN_MAP.prov.map(p => {
    const on = litSet.has(p.n);
    return `<path d="${p.d}" fill="${on ? "#dcf3dd" : "#f4f7fb"}" stroke="${on ? "#7fae8e" : "#b9c9dd"}" stroke-width="1"></path>`;
  }).join("");
  const decoPath = `<path d="${CN_MAP.deco}" stroke="#b9c9dd" stroke-dasharray="3 3" fill="none"></path>`;
  const visitedIds = new Set(state.visited);
  const favIds = new Set(state.favs);
  const grayDots = [], hotDots = []; // 已打卡/收藏点后画，压在灰点上层
  DATA.forEach(d => {
    const coords = (d.stops && d.stops.length ? byId(d.stops[0].id)?.coords : d.coords) || null; // 线路卡取首站坐标
    if (!coords) return;
    const [lat, lng] = coords;
    const x = ((lng - CN_MAP.prj.lng0) * CN_MAP.prj.kx).toFixed(1);
    const y = ((CN_MAP.prj.lat1 - lat) * CN_MAP.prj.ky).toFixed(1);
    const isVisited = !d.stops && visitedIds.has(d.id);
    const isFav = favIds.has(d.id);
    const hit = `<circle class="map-dot" cx="${x}" cy="${y}" r="7" fill="transparent" data-mapdot="${d.id}"></circle>`;
    let mark;
    if (isFav) {
      mark = `<text x="${x}" y="${y}" font-size="13" text-anchor="middle" dominant-baseline="central" fill="#ff6b81" stroke="#fff" stroke-width="0.5" paint-order="stroke" pointer-events="none">♥</text>`;
    } else if (isVisited) {
      mark = `<circle cx="${x}" cy="${y}" r="3.5" fill="#2e7d43" stroke="#fff" stroke-width="1" pointer-events="none"></circle>`;
    } else {
      mark = `<circle cx="${x}" cy="${y}" r="2.2" fill="#b9c6d6" pointer-events="none"></circle>`;
    }
    (isFav || isVisited ? hotDots : grayDots).push(`<g>${hit}${mark}</g>`);
  });
  document.getElementById("mapBody").innerHTML = `
    <h2 style="font-family:var(--round); margin:0 0 4px">🗺 我的足迹地图</h2>
    ${statHTML}
    <div class="map-legend">
      <span><span class="lg-dot" style="background:#b9c6d6"></span>灰点 = 没去过</span>
      <span><span class="lg-dot" style="background:#2e7d43"></span>绿点 = 去过</span>
      <span>♥ = 收藏</span>
    </div>
    <div class="map-scroll">
      <svg viewBox="${CN_MAP.vb}" xmlns="http://www.w3.org/2000/svg">
        ${provPaths}
        ${decoPath}
        ${grayDots.join("")}
        ${hotDots.join("")}
      </svg>
    </div>
    <p class="map-foot">点地图上的点可看详情 · 省界为简化示意</p>`;
}

/* ================= 扭蛋 ================= */
let rolling = false, lastPick = null;

function openGacha() {
  const parts = [];
  if (state.region.size) parts.push([...state.region].join("/"));
  if (state.season.size) parts.push([...state.season].join("/") + "季");
  if (state.days.size) parts.push(DAY_BUCKETS.filter(b => state.days.has(b.key)).map(b => b.label).join("/"));
  if (state.crowd.size) parts.push([...state.crowd].join("/"));
  if (state.cost.size) parts.push([...state.cost].join("/"));
  if (state.difficulty.size) parts.push([...state.difficulty].join("/"));
  if (state.effort.size) parts.push([...state.effort].join("/"));
  if (state.companions.size) parts.push([...state.companions].join("/"));
  if (state.tags.size) parts.push([...state.tags].join("+"));
  if (state.noAlt) parts.push("避开高海拔");
  if (state.hideVisited) parts.push("隐藏去过");
  if (state.q) parts.push(`「${state.q}」`);
  const pool = filtered();
  document.getElementById("gachaScope").innerHTML =
    (parts.length ? `扭蛋池：<b>${parts.join(" · ")}</b>` : "扭蛋池：全国不限") + `｜共 <b>${pool.length}</b> 颗蛋`;
  document.getElementById("gCity").textContent = pool.length ? "？？？" : "空空如也";
  relaxCands = pool.length ? [] : relaxCandidates();
  document.getElementById("gSub").textContent = pool.length ? "转一下旋钮，命运发货"
    : (relaxCands.length ? `筛选太严了，${relaxCands[0].label}就有 ${relaxCands[0].n} 颗` : "筛选太严了，回去放宽一点");
  const gr = document.getElementById("gRelaxBtn");
  gr.style.display = !pool.length && relaxCands.length ? "" : "none";
  if (relaxCands.length) gr.textContent = `${relaxCands[0].label}，再扭`;
  document.getElementById("gKnob").style.display = pool.length ? "" : "none";
  document.getElementById("gDetailBtn").style.display = "none";
  document.getElementById("gTripBtn").style.display = "none";
  const t = document.getElementById("gachaTicket"); t.className = ""; t.innerHTML = "";
  document.getElementById("gachaOverlay").classList.add("show");
}

function roll() {
  if (rolling) return;
  const pool = filtered(); if (!pool.length) return;
  rolling = true;
  const cityEl = document.getElementById("gCity");
  const subEl = document.getElementById("gSub");
  const knob = document.getElementById("gKnob");
  const ticketEl = document.getElementById("gachaTicket");
  ticketEl.className = ""; ticketEl.innerHTML = "";
  document.getElementById("gDetailBtn").style.display = "none";
  document.getElementById("gTripBtn").style.display = "none";
  knob.disabled = true; knob.classList.add("turn");
  cityEl.classList.add("spin");

  const pick = pool[Math.floor(Math.random() * pool.length)];
  lastPick = pick;
  let t = 0;
  const totalMs = 2300;
  const step = (delay) => {
    const r = pool[Math.floor(Math.random() * pool.length)];
    cityEl.textContent = r.emoji + " " + r.name;
    subEl.textContent = r.province + " · " + r.region;
    t += delay;
    if (t < totalMs) setTimeout(() => step(Math.min(delay * 1.2, 300)), delay);
    else {
      cityEl.classList.remove("spin");
      cityEl.textContent = pick.emoji + " " + pick.name;
      subEl.textContent = `${pick.province} · ${pick.region} · ${pick.crowd}`;
      ticketEl.innerHTML = cardHTML(pick, 0);
      ticketEl.className = "show";
      document.getElementById("gDetailBtn").style.display = "";
      document.getElementById("gTripBtn").style.display = "";
      knob.disabled = false; knob.classList.remove("turn");
      rolling = false;
      confetti();
    }
  };
  step(60);
}

/* ================= 行程规划 ================= */
function tripStops() { return state.trip.map(t => ({ ...byId(t.id), chosenDays: t.days, fromRoute: !!t.r, rid: t.r })); }

function autoOrder() {
  const rest = [...state.trip];
  const ordered = [];
  let cur = SH.coords;
  while (rest.length) {
    let bi = 0, bd = Infinity;
    rest.forEach((t, i) => {
      const km = hav(cur, byId(t.id).coords);
      if (km < bd) { bd = km; bi = i; }
    });
    const next = rest.splice(bi, 1)[0];
    ordered.push(next);
    cur = byId(next.id).coords;
  }
  state.trip = ordered;
  saveLS(); renderTrip(); render();
  toast("已按顺路顺序重排 🧭");
}

// 进出门户（F31）：线路可声明 entry/exit=城市 id（如三亚进、海口出），与首末停留站不同。
// 仅当行程恰好是某条线路的完整整组时生效——首末大交通、逐日速览、详情、预算都用真实进出点。
function tripGateway() {
  const stops = tripStops();
  if (!stops.length) return null;
  const rid = stops[0].rid;
  if (!rid || !stops.every(s => s.rid === rid)) return null; // 必须全部同一条线路
  if (legEligibleIndices(stops).size !== stops.length) return null; // 且为完整整组（齐全/同序/默认天数）
  const rt = byId(rid);
  if (!rt) return null;
  const entry = rt.entry ? byId(rt.entry) : null;
  const exit = rt.exit ? byId(rt.exit) : null;
  return (entry || exit) ? { entry, exit } : null;
}
function tripLegs() {
  const stops = tripStops();
  const legIdx = legEligibleIndices(stops); // 整组完整启用 leg 的站下标（F21）
  const gw = tripGateway();
  const pts = [SH, ...stops, SH];
  const legs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    let a = pts[i], b = pts[i + 1];
    const si = i - 1; // a 在 stops 中的下标（i≥1 时）；leg i 连接 stops[si]→stops[si+1]
    const inGroup = i >= 1 && i < stops.length && legIdx.has(si) && legIdx.has(si + 1)
      && stops[si].rid && stops[si].rid === stops[si + 1].rid;
    // 相邻两站同属一条完整 leg 组 → 陆路段，禁用飞机判定（F29）
    const overland = inGroup;
    // 进入 stops[si+1] 的段若目标站 leg 带显式 transport（游轮/轮渡/火车），用它覆盖启发式（F30）
    let transport = null;
    if (inGroup) {
      const dest = stops[si + 1], rt = byId(dest.rid);
      const st = rt && rt.stops && rt.stops.find(s => s.id === dest.id);
      if (st && st.leg && st.leg.transport) transport = st.leg.transport;
    }
    // 门户改写首末大交通端点（F31）：上海→入口门户、出口门户→上海
    let gwName = null;
    if (gw && i === 0 && gw.entry) { b = gw.entry; gwName = gw.entry.name; }
    if (gw && i === pts.length - 2 && gw.exit) { a = gw.exit; gwName = gw.exit.name; }
    legs.push({ from: a, to: b, gwName, ...legInfo(a.coords ? a : { ...a }, b, overland, transport) });
  }
  return legs;
}

function tripBudget() {
  const stops = tripStops();
  const daySum = stops.reduce((s, d) => s + d.chosenDays, 0);
  let stay = stops.reduce((s, d) => s + d.chosenDays * PER_DAY_COST[d.cost], 0);
  const legs = tripLegs();
  const trans = legs.reduce((s, l) => s + (l.mode === "飞机" ? 550 + l.km * 0.35 : l.km * 0.5), 0);
  const lo = Math.round((stay * 0.8 + trans) / 100) * 100;
  const hi = Math.round((stay * 1.25 + trans * 1.15) / 100) * 100;
  return { daySum, lo, hi, km: legs.reduce((s, l) => s + l.km, 0) };
}

function renderTrip() {
  const listEl = document.getElementById("stopList");
  const stops = tripStops();
  if (!stops.length) {
    listEl.innerHTML = `<p style="color:var(--ink-soft);text-align:center;padding:20px 0">行程还是空的，去卡片上点「🧳 行程」加几站吧</p>`;
    document.getElementById("tripStats").innerHTML = "";
    document.getElementById("tripSugg").innerHTML = "";
    return;
  }
  const legs = tripLegs();
  let html = `<div class="leg-line"><span class="dash"></span>🏠 上海出发 · ${legs[0].icon} ${legs[0].mode} ${fmtH(legs[0].hours)}（约${legs[0].km}km）${legs[0].gwName ? " → " + legs[0].gwName + "（进线门户）" : ""}</div>`;
  stops.forEach((d, i) => {
    html += `
    <div class="stop" data-idx="${i}">
      <span class="stop-idx">${i + 1}</span>
      <span class="c-emoji" style="width:36px;height:36px;font-size:18px;--rs:${REGION_COLOR[d.region]};background:${REGION_COLOR[d.region]}">${d.emoji}</span>
      <span class="stop-name">${d.name}<br><span class="sm">${d.province} · ${d.crowd}</span></span>
      <span class="stop-ctrl">
        <select data-days="${i}" title="这一站玩几天">
          ${(d.fromRoute ? Array.from({ length: Math.max(...d.days) }, (_, k) => k + 1) : [...new Set([...d.days, d.chosenDays])]).sort((a, b) => a - b).map(n => `<option value="${n}" ${n === d.chosenDays ? "selected" : ""}>${n}天</option>`).join("")}
        </select>
        <button class="mini" data-up="${i}" title="上移">↑</button>
        <button class="mini" data-down="${i}" title="下移">↓</button>
        <button class="mini" data-del="${i}" title="移除">✕</button>
      </span>
    </div>`;
    const leg = legs[i + 1];
    html += `<div class="leg-line"><span class="dash"></span>${leg.icon} ${leg.mode} ${fmtH(leg.hours)}（约${leg.km}km）${i === stops.length - 1 ? (leg.gwName ? " · 经" + leg.gwName + "返回上海 🏠" : " · 返回上海 🏠") : ""}</div>`;
  });
  listEl.innerHTML = html;

  const b = tripBudget();
  document.getElementById("tripStats").innerHTML = `
    <span>🗓 全程 <b>${b.daySum} 天</b>（不含赶路损耗）</span>
    <span>📏 总里程 <b>约 ${b.km} km</b></span>
    <span>💰 人均预算 <b>¥${b.lo.toLocaleString()} ~ ${b.hi.toLocaleString()}</b></span>`;

  // 顺路彩蛋（M28）：两类候选同池混排（度量同为 km，取小者），绕路/距离 <200km，前 3 个；
  // ①廊道顺路=插进陆路段绕路最少（+绕Nkm）②落脚顺游=贴着某站 ≤150km 的短驳（距X Nkm）；
  // 线路卡不进彩蛋（整条装入是行程单动作）；全程直飞且各站周边无卡的行程没有彩蛋，是诚实答案；
  // 尊重「避开高海拔」「隐藏去过的」两个开关（四轮）——不给避高原的人推高海拔、不重推去过的
  const near = DATA
    .filter(d => !d.stops && !state.trip.some(t => t.id === d.id)
      && !(state.noAlt && d.alt) && !(state.hideVisited && state.visited.includes(d.id)))
    .map(d => ({ d, ...bestInsertion(d) }))
    .filter(x => x.add < 200)
    .sort((a, b2) => a.add - b2.add).slice(0, 3);
  document.getElementById("tripSugg").innerHTML = near.length
    ? `💡 顺路彩蛋（顺路捡一站 / 到站顺游）：` + near.map(x =>
      `<button class="chip" data-onway="${x.d.id}" style="margin-left:6px">${x.d.emoji} ${x.d.name} · ${x.near ? `距${x.near.name.split(" · ")[0]}约${Math.max(1, Math.round(x.add))}km` : `+绕${Math.max(1, Math.round(x.add))}km`} ＋</button>`).join("")
    : "";
}

// M28：候选点插入现有环线哪一段绕路最少（add=度量km，at=对应 state.trip 的插入下标）
// F17：差值用不取整的 havRaw——取整后的三边差可为负，展示时再取整并夹到 ≥1
// M28 二轮（用户反馈）：纯几何三边差只对陆路段有意义——直飞大圆航线正下方的点增量≈0
// （上海⇄拉萨曾推「苏州 +绕0km」），但飞机段上不存在「顺路」。
// M28 三轮（落脚顺游）：「到了成都顺便乐山」成立——候选贴着某个非上海站点（直线 ≤150km
// 且该短驳非飞机）时允许插在该站旁，near=锚定站，add 改用「距锚定站 km」（spur 的
// 三边差会把往返里程虚大，距离才是用户关心的量）。两类度量同为 km，混排取小者优先。
const NEAR_KM = 150;
function bestInsertion(c) {
  const pts = [SH, ...tripStops(), SH];
  let add = Infinity, at = 0, near = null, tie = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const extra = havRaw(a.coords, c.coords) + havRaw(c.coords, b.coords) - havRaw(a.coords, b.coords);
    const anyFly = legInfo(a, b).mode === "飞机" || legInfo(a, c).mode === "飞机" || legInfo(c, b).mode === "飞机";
    let m = null, anch = null;
    if (!anyFly) m = extra; // 廊道顺路：段与两子段全陆路，度量=绕路增量
    else for (const e of [a, b]) { // 落脚顺游：只认贴着本段非上海端点的候选
      if (e === SH) continue;
      const dk = havRaw(e.coords, c.coords);
      if (dk <= NEAR_KM && legInfo(e, c).mode !== "飞机" && (m === null || dk < m)) { m = dk; anch = e; }
    }
    if (m === null) continue;
    // F34：单站行程时「锚点前」「锚点后」两个缺口对同一候选给出完全相同的 m/extra（对称算式），
    // 严格 `<` 只会留住先遍历到的锚点前一侧，把「到了成都顺便乐山」插成「乐山→成都」。
    // 完全并列（同锚点、同度量）时优先锚点后的出站位（a===anch，即插在锚点之后）。
    const afterAnchorTie = m === add && extra === tie && anch !== null && anch === near && a === anch;
    if (m < add || (m === add && extra < tie) || afterAnchorTie) { add = m; at = i; near = anch; tie = extra; }
  }
  return { add, at, near };
}
function insertOnWay(id) {
  const d = byId(id);
  if (!d || d.stops || state.trip.some(t => t.id === id)) return;
  if (state.trip.length >= 6) { toast("一次行程最多 6 站，贪多嚼不烂～"); return; }
  const { add, at } = bestInsertion(d);
  if (!isFinite(add)) return; // 防御：无可插的陆路段（正常情况下按钮就不会渲染）
  state.trip.splice(at, 0, { id, days: Math.min(...d.days) });
  saveLS(); render(); renderTrip();
  toast(`已顺路插到第 ${at + 1} 站：${d.name}`);
}

function openTrip() { renderTrip(); document.getElementById("tripOverlay").classList.add("show"); }

/* ================= 路书 ================= */
function pickPlan(d, days) {
  let best = d.plans[0];
  d.plans.forEach(p => {
    if (p.days === days) best = p;
    else if (p.days < days && p.days > best.days && best.days !== days) best = p;
  });
  const exact = d.plans.find(p => p.days === days);
  return exact || best;
}

// F18/F21：线路装入的 stop 优先用「线路视角」的逐日文案（leg={route,stays}），而非城市独立游方案——
// 城市卡 plans 描述的是"在这座城住几天放射游"，而线路要的是"这一段路怎么开、当晚睡哪"。
// leg 是「线路上下文」文案（写死了前后站顺序），只有整条线路在行程里保持原样才成立：
// F21——同一 rid 的全部 stop 必须齐全、连续、同序、天数=默认，才整组启用 leg；
// 用户上移/下移/删站/顺路排序/只装入半条 → 组失效，整组回退城市 pickPlan（避免"半条线路+全量分段文案"错位）。
function legEligibleIndices(stops) {
  const ok = new Set();
  [...new Set(stops.filter(d => d.rid).map(d => d.rid))].forEach(rid => {
    const rt = byId(rid);
    if (!rt || !rt.stops) return;
    const idxs = stops.map((d, i) => (d.rid === rid ? i : -1)).filter(i => i >= 0);
    const contiguous = idxs.every((v, k) => k === 0 || v === idxs[k - 1] + 1);
    const intact = idxs.length === rt.stops.length
      && rt.stops.every((s, k) => stops[idxs[k]].id === s.id && stops[idxs[k]].chosenDays === s.days);
    if (contiguous && intact) idxs.forEach(i => ok.add(i));
  });
  return ok;
}
function planForStop(d, legOn) {
  const base = pickPlan(d, d.chosenDays);
  if (!legOn) return base;
  const st = byId(d.rid).stops.find(s => s.id === d.id);
  return st && st.leg ? { days: d.chosenDays, title: byId(d.rid).name, route: st.leg.route, stays: st.leg.stays } : base;
}
function roadbookModel() {
  const stops = tripStops();
  const legIdx = legEligibleIndices(stops);
  const legs = tripLegs();
  let day = 0;
  const items = stops.map((d, i) => {
    const start = day + 1, end = day + d.chosenDays;
    day = end;
    return { d, start, end, plan: planForStop(d, legIdx.has(i)), legIn: legs[i], legOut: i === stops.length - 1 ? legs[i + 1] : null };
  });
  return { stops, legs, items, budget: tripBudget() };
}

/* M29 逐日骨架：每天一行「日期/D序号 · 当日动作 · 宿地」 */
const shortName = d => d.name.split(" · ")[0].split("·")[0].split("（")[0].split("(")[0]; // 「伊犁（伊宁·赛里木湖…）」→「伊犁」
const WEEK_CN = ["日", "一", "二", "三", "四", "五", "六"];
function tripDate(n) { // 第 n 天（1-based）的日期；未设出发日期返回 null
  if (!state.tripStart) return null;
  const t = new Date(state.tripStart + "T00:00:00");
  if (isNaN(t)) return null;
  t.setDate(t.getDate() + (n - 1));
  return t;
}
const fmtMD = t => `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")} 周${WEEK_CN[t.getDay()]}`;
const fmtYMD = t => `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, "0")}${String(t.getDate()).padStart(2, "0")}`;
// 宿地：路线型方案带 stays（每晚落脚点，build 校验与 plan.days 等长）；基地型=城市名。
// 就近降配（chosenDays≠plan.days）时 stays 下标截断到最后一晚。
function skeletonRows(items) {
  const rows = [];
  items.forEach((it, i) => {
    const name = shortName(it.d);
    const stays = it.plan.stays;
    const stayAt = k => stays ? stays[Math.min(k, stays.length - 1)] : name;
    for (let k = 0; k < it.d.chosenDays; k++) {
      const isTripLast = it.legOut && k === it.d.chosenDays - 1;
      let act;
      if (k === 0) {
        const from = i === 0 ? "上海" : shortName(items[i - 1].d);
        const dest = it.legIn.gwName || name; // 入口门户（F31）优先作为「上海 → X」的目标
        act = `${from} → ${dest}（${it.legIn.mode} ${fmtH(it.legIn.hours)}）`;
        if (it.legIn.gwName || (stays && stayAt(0) !== name)) act += `，进线到${stayAt(0)}`;
      } else if (stays && stayAt(k) !== stayAt(k - 1)) {
        act = `${stayAt(k - 1)} → ${stayAt(k)}（沿线玩过去）`;
      } else if (stays && TRANSPORT_META[stayAt(k)]) {
        // F35：连住同一移动住宿（游轮/轮渡/火车）不是地名，「游X一带」句式读出「游游轮一带」的胡话
        act = `${stayAt(k)}上继续游览沿途景点`;
      } else {
        act = `游${stays ? stayAt(k) + "一带" : name}`;
      }
      if (isTripLast) {
        act += `，${it.legOut.gwName ? "经" + it.legOut.gwName : ""}${it.legOut.mode}返回上海（${fmtH(it.legOut.hours)}）`;
        rows.push({ n: it.start + k, act, stay: "🏠 回家" });
      } else {
        rows.push({ n: it.start + k, act, stay: stayAt(k) });
      }
    }
  });
  return rows;
}
const skelDayLabel = n => {
  const t = tripDate(n);
  return { d: `D${n}`, date: t ? fmtMD(t) : "" };
};

function roadbookHTML() {
  const m = roadbookModel();
  const title = m.stops.map(shortName).join(" → ");
  const legLine = (l, note) => `<div class="rb-leg">${l.icon} ${note} · ${l.mode} ${fmtH(l.hours)}（约${l.km}km，估算）</div>`;
  const dayRange = it => { // 「D2–D3」＋设了出发日期时的「07-08~07-09」
    const tag = `D${it.start}${it.end > it.start ? "–D" + it.end : ""}`;
    const t1 = tripDate(it.start);
    if (!t1) return tag;
    const t2 = tripDate(it.end);
    return `${tag}（${fmtMD(t1)}${it.end > it.start ? " ~ " + fmtMD(t2) : ""}）`;
  };
  const rows = skeletonRows(m.items);
  return `
  <div class="rb-cover">
    <h2 class="rb-title">🧭 ${title}</h2>
    <div class="rb-meta">${m.budget.daySum} 天 · ${m.stops.length} 站 · 总里程约 ${m.budget.km}km · 上海往返${state.tripStart ? ` · ${state.tripStart} 出发` : ""} · 生成于 ${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}</div>
  </div>
  <div class="rb-skel">
    <div class="rb-skel-t">🗓 逐日速览</div>
    ${rows.map(r => {
      const lb = skelDayLabel(r.n);
      return `<div class="rb-sk-row">${lb.date ? `<span class="rb-sk-date">${lb.date}</span>` : ""}<span class="rb-sk-d">${lb.d}</span><span class="rb-sk-act">${r.act}</span><span class="rb-sk-stay">${r.stay === "🏠 回家" ? r.stay : "宿 " + r.stay}</span></div>`;
    }).join("")}
  </div>
  ${m.items.map((it, i) => `
    ${legLine(it.legIn, i === 0 ? "上海 → " + (it.legIn.gwName || it.d.name) : m.items[i - 1].d.name + " → " + it.d.name)}
    <div class="rb-day"><span class="rb-dtag">${dayRange(it)}</span></div>
    <div class="rb-stop">
      <h4>${it.d.emoji} ${it.d.name} <span style="font-size:12px;color:var(--ink-soft);font-family:var(--sans)">（${it.d.chosenDays}天 · 方案「${it.plan.title}」${it.plan.days !== it.d.chosenDays ? "，按" + it.plan.days + "天版改编" : ""}）</span></h4>
      <div class="rb-plan">${it.plan.route}</div>
      <div class="rb-facts">
        <span><b>🍜 别错过：</b>${it.d.food.slice(0, 4).join("、")}</span>
        ${it.d.highlights.length ? `<span><b>✨ 特色：</b>${it.d.highlights.slice(0, 2).join("；")}</span>` : ""}
        ${ROUTE_STAY.has(it.d.id) ? `<span><b>🧭 节奏：</b>路线型玩法，沿线多点换宿——按每晚落脚点分段订房，不必全程订一处</span>` : ""}
        <span><b>🏨 住宿：</b>${it.d.hotel || "以酒店 App 实查为准"}</span>
        <span><b>🚌 市内：</b>${it.d.local || "打车/公共交通"}</span>
        <span><b>🌤 季节：</b>${it.d.seasonNote}</span>
        <span class="rb-wx" data-wx="${it.d.id}"></span>
      </div>
    </div>
    ${it.legOut ? legLine(it.legOut, it.d.name + (it.legOut.gwName ? " → " + it.legOut.gwName : "") + " → 上海（返程）") : ""}
  `).join("")}
  <div class="trip-stats rb-budget">
    <span>💰 人均预算 <b>¥${m.budget.lo.toLocaleString()} ~ ${m.budget.hi.toLocaleString()}</b>（含大交通与住宿餐饮，不含购物）</span>
  </div>
  <div class="rb-note">※ 交通方式与时长为直线距离估算，出发前请以 12306 / 航旅 App 实际班次为准；房态与价格以酒店 App 实时为准。天气参考数据来自 <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>（<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>），经本站整理换算。</div>
  <div class="rb-actions no-print">
    <button class="big-btn blue" id="copyRbBtn">📋 复制路书文本</button>
    <button class="big-btn ghost" id="printRbBtn">🖨 打印 / 存 PDF</button>
  </div>`;
}

function roadbookText() {
  const m = roadbookModel();
  const title = m.stops.map(d => d.name).join(" → ");
  let s = `🧭 ${title}（${m.budget.daySum}天 · 上海往返${state.tripStart ? ` · ${state.tripStart} 出发` : ""}）\n`;
  let wxUsed = false;
  s += `总里程约 ${m.budget.km}km · 人均预算 ¥${m.budget.lo}~${m.budget.hi}\n\n`;
  s += `【逐日速览】\n`;
  skeletonRows(m.items).forEach(r => {
    const t = tripDate(r.n);
    s += `${t ? fmtYMD(t) + " " : ""}D${r.n} ${r.act} ${r.stay === "🏠 回家" ? "当晚到家" : "宿" + r.stay}\n`;
  });
  s += `\n`;
  m.items.forEach((it, i) => {
    const inName = i === 0 ? "上海" : m.items[i - 1].d.name;
    const outName = (i === 0 && it.legIn.gwName) ? it.legIn.gwName : it.d.name; // 入口门户（F31）
    s += `【${inName} → ${outName}】${it.legIn.mode} ${fmtH(it.legIn.hours)}（约${it.legIn.km}km）\n`;
    s += `D${it.start}${it.end > it.start ? "–D" + it.end : ""} ${it.d.name}（${it.d.chosenDays}天 · ${it.plan.title}）\n`;
    s += `  行程：${it.plan.route}\n`;
    s += `  美食：${it.d.food.slice(0, 4).join("、")}\n`;
    if (ROUTE_STAY.has(it.d.id)) s += `  节奏：路线型玩法，沿线多点换宿（按每晚落脚点分段订房）\n`;
    s += `  住宿：${it.d.hotel || "以酒店App实查为准"}\n`;
    s += `  市内：${it.d.local || "打车/公共交通"}\n`;
    const wxDays = wxCacheGet(it.d.id); // 只读缓存，不发请求；没缓存就不加这行
    if (wxDays) { wxUsed = true; s += `  天气参考：${wxLine(wxDays)}\n`; }
    s += `\n`;
    if (it.legOut) s += `【${it.d.name}${it.legOut.gwName ? " → " + it.legOut.gwName : ""} → 上海】${it.legOut.mode} ${fmtH(it.legOut.hours)}（约${it.legOut.km}km）\n\n`;
  });
  s += "※ 时长为估算，请以 12306/航班动态为准。";
  if (wxUsed) s += "\n※ 天气参考数据来自 Open-Meteo（https://open-meteo.com · CC BY 4.0 https://creativecommons.org/licenses/by/4.0/），经本站整理换算。";
  return s;
}

let rbWxGen = 0; // 防止用户改动行程后快速重开路书时，旧请求把天气写串到新渲染的节点上
function openRoadbook() {
  if (!state.trip.length) { toast("行程还是空的"); return; }
  document.getElementById("rbBody").innerHTML = roadbookHTML();
  document.getElementById("rbOverlay").classList.add("show");
  fillRoadbookWeather(++rbWxGen);
}
async function fillRoadbookWeather(gen) {
  const stops = tripStops();
  await Promise.all(stops.map(async d => {
    const days = await fetchWeather(d);
    if (!days || gen !== rbWxGen) return;
    const el = document.querySelector(`[data-wx="${d.id}"]`);
    if (el) el.innerHTML = `<b>⛅ 未来7天参考：</b>${wxLine(days)}`;
  }));
}

function copyText(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => toast("已复制，去粘贴吧 📋"), () => fallbackCopy(txt));
  } else fallbackCopy(txt);
}
function fallbackCopy(txt) {
  const ta = document.createElement("textarea");
  ta.value = txt; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); toast("已复制 📋"); } catch (e) { toast("复制失败，请手动选择文本"); }
  ta.remove();
}

/* ================= M26 分享/备份（打卡+收藏跨设备迁移） ================= */
const SHARE_QR_MAX = 1200; // QR 40-M 上限 2331 字节，留足裕量；超了提示走 JSON
function shareLink() {
  return location.href.split("#")[0] + "#s=" + `f:${state.favs.join(".")};v:${state.visited.join(".")}`;
}
function parseShare(str) { // "f:a.b;v:c.d" → 只收当前数据集内合法的 id（visited 仅城市，favs 城市+线路都行）
  const m = /^f:([^;]*);v:(.*)$/.exec(str || "");
  if (!m) return null;
  const allIds = new Set(DATA.map(d => d.id));
  const cityIds = new Set(DATA.filter(d => !d.stops).map(d => d.id));
  return {
    favs: [...new Set(m[1].split(".").filter(id => allIds.has(id)))],
    visited: [...new Set(m[2].split(".").filter(id => cityIds.has(id)))],
  };
}
function mergeRecords(p) { // 并集合并，绝不覆盖本机已有；行程/对比不动
  const nf = p.favs.filter(id => !state.favs.includes(id)).length;
  const nv = p.visited.filter(id => !state.visited.includes(id)).length;
  state.favs = [...new Set([...state.favs, ...p.favs])];
  state.visited = [...new Set([...state.visited, ...p.visited])];
  saveLS(); render();
  toast(nf || nv ? `已合并：新收藏 ${nf} · 新打卡 ${nv} 🎒` : "这些记录本机都有啦");
}
function checkShareHash() { // 带 #s= 打开页面：顶部确认条，点「合并」才写入；无论如何都清掉 hash
  if (!location.hash.startsWith("#s=")) return;
  const p = parseShare(decodeURIComponent(location.hash.slice(3)));
  history.replaceState(null, "", location.pathname + location.search);
  if (!p || (!p.favs.length && !p.visited.length)) return;
  const bar = document.getElementById("importBar");
  document.getElementById("importBarText").textContent = `收到一份迁移记录：♥ ${p.favs.length} 收藏 · 👣 ${p.visited.length} 打卡。合并进本机？`;
  bar.style.display = "flex";
  document.getElementById("importYes").onclick = () => { bar.style.display = "none"; mergeRecords(p); };
  document.getElementById("importNo").onclick = () => { bar.style.display = "none"; };
}
function openShare() {
  document.getElementById("shareStats").textContent = `本机现有：♥ ${state.favs.length} 个收藏 · 👣 ${state.visited.length} 个打卡`;
  document.getElementById("qrWrap").style.display = "none";
  document.getElementById("shareOverlay").classList.add("show");
}
function renderShareQR() { // 二维码默认收起，点按钮才展开（用户要求：别大别占地方）
  const wrap = document.getElementById("qrWrap"), hint = document.getElementById("qrHint"), cv = document.getElementById("qrCanvas");
  if (wrap.style.display !== "none") { wrap.style.display = "none"; return; }
  wrap.style.display = "";
  const link = shareLink();
  try {
    if (link.length > SHARE_QR_MAX || typeof qrEncode !== "function") throw new Error("too long");
    const q = qrEncode(link);
    const scale = 4, quiet = 4, n = q.size + quiet * 2;
    cv.width = cv.height = n * scale;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#000";
    q.modules.forEach((row, r) => row.forEach((v, c) => { if (v) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale); }));
    cv.style.display = "";
    hint.textContent = "手机扫码打开页面，点「合并」即可";
  } catch (e) {
    cv.style.display = "none";
    hint.textContent = "记录太多，二维码装不下——用「复制 JSON」迁移吧";
  }
}
function importJSON() {
  let obj;
  try { obj = JSON.parse(document.getElementById("importBox").value); } catch (e) { toast("JSON 没解析出来，检查一下粘贴内容"); return; }
  // F16：合法 JSON 但不是对象（null/数字/数组）也要走格式提示，不能裸访问 obj.favs 抛异常
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) { toast('格式不对——需要 {"favs":[…],"visited":[…]}'); return; }
  const p = parseShare(`f:${(Array.isArray(obj.favs) ? obj.favs : []).join(".")};v:${(Array.isArray(obj.visited) ? obj.visited : []).join(".")}`);
  if (!p || (!p.favs.length && !p.visited.length)) { toast("没找到可导入的记录"); return; }
  mergeRecords(p);
  document.getElementById("importBox").value = "";
}

/* ================= 彩带 ================= */
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.getElementById("confettiCanvas");
  const ctx = cv.getContext("2d");
  cv.width = innerWidth; cv.height = innerHeight; cv.style.display = "block";
  const colors = ["#ff9c3f", "#58b7f0", "#7bc86c", "#f79ec4", "#ffd95c", "#b39deb"];
  const ps = Array.from({ length: 120 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 260,
    y: innerHeight * 0.3,
    vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 3,
    s: Math.random() * 8 + 4,
    c: colors[Math.floor(Math.random() * colors.length)],
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.32; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
      ctx.restore();
    });
    if (++frames < 110) requestAnimationFrame(tick);
    else cv.style.display = "none";
  })();
}

/* ================= 事件 ================= */
document.addEventListener("click", e => {
  const fav = e.target.closest("[data-fav]");
  if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
  const cmp = e.target.closest("[data-cmp]");
  if (cmp) { e.stopPropagation(); toggleCmp(cmp.dataset.cmp); if (cmp.closest("#detailBody")) openDetail(cmp.dataset.cmp); return; }
  const trip = e.target.closest("[data-trip]");
  if (trip) { e.stopPropagation(); toggleTrip(trip.dataset.trip); if (trip.closest("#detailBody")) openDetail(trip.dataset.trip); return; }
  const onway = e.target.closest("[data-onway]");
  if (onway) { insertOnWay(onway.dataset.onway); return; }
  const addRoute = e.target.closest("[data-addroute]");
  if (addRoute) { e.stopPropagation(); addRouteToTrip(addRoute.dataset.addroute); return; }
  const rmCmp = e.target.closest("[data-rmcmp]");
  if (rmCmp) { toggleCmp(rmCmp.dataset.rmcmp); return; }
  const rmTrip = e.target.closest("[data-rmtrip]");
  if (rmTrip) { toggleTrip(rmTrip.dataset.rmtrip); return; }
  const up = e.target.closest("[data-up]");
  if (up) { const i = +up.dataset.up; if (i > 0) { [state.trip[i - 1], state.trip[i]] = [state.trip[i], state.trip[i - 1]]; saveLS(); renderTrip(); } return; }
  const down = e.target.closest("[data-down]");
  if (down) { const i = +down.dataset.down; if (i < state.trip.length - 1) { [state.trip[i + 1], state.trip[i]] = [state.trip[i], state.trip[i + 1]]; saveLS(); renderTrip(); } return; }
  const del = e.target.closest("[data-del]");
  if (del) { state.trip.splice(+del.dataset.del, 1); saveLS(); renderTrip(); render(); return; }
  if (e.target.id === "copyRbBtn") { copyText(roadbookText()); return; }
  if (e.target.id === "printRbBtn") { window.print(); return; }
  const vis = e.target.closest("[data-visited]");
  if (vis) { e.stopPropagation(); toggleVisited(vis.dataset.visited); if (vis.closest("#detailBody")) openDetail(vis.dataset.visited); return; }
  const mapDot = e.target.closest("[data-mapdot]");
  if (mapDot) { e.stopPropagation(); openDetail(mapDot.dataset.mapdot); return; }
  const card = e.target.closest(".card");
  if (card && !e.target.closest(".act")) openDetail(card.dataset.id);
});
document.addEventListener("change", e => {
  const sel = e.target.closest("[data-days]");
  if (sel) { state.trip[+sel.dataset.days].days = +sel.value; saveLS(); renderTrip(); }
});

document.getElementById("cmpGo").addEventListener("click", openCompare);
document.getElementById("tripGo").addEventListener("click", openTrip);
document.getElementById("cmpClear").addEventListener("click", () => { state.cmp = []; saveLS(); render(); toast("对比已清空"); });
document.getElementById("tripClear").addEventListener("click", () => { state.trip = []; saveLS(); render(); toast("行程已清空"); });
document.getElementById("fabGacha").addEventListener("click", openGacha);
document.getElementById("gKnob").addEventListener("click", roll);
document.getElementById("empty").addEventListener("click", e => {
  const b = e.target.closest("[data-relax]");
  if (b) applyRelax(+b.dataset.relax);
});
document.getElementById("emptyResetBtn").addEventListener("click", resetFilters);
document.getElementById("gRelaxBtn").addEventListener("click", () => { applyRelax(0); openGacha(); });
document.getElementById("gDetailBtn").addEventListener("click", () => lastPick && openDetail(lastPick.id));
document.getElementById("gTripBtn").addEventListener("click", () => {
  if (!lastPick) return;
  if (lastPick.stops) { addRouteToTrip(lastPick.id); return; } // 线路卡：整条展开装入
  if (!state.trip.some(t => t.id === lastPick.id)) toggleTrip(lastPick.id); else toast("已经在行程里啦");
});
document.getElementById("shareLinkBtn").addEventListener("click", () => copyText(shareLink()));
document.getElementById("shareQrBtn").addEventListener("click", renderShareQR);
document.getElementById("shareJsonBtn").addEventListener("click", () => copyText(JSON.stringify({ favs: state.favs, visited: state.visited })));
document.getElementById("importBtn").addEventListener("click", importJSON);
document.getElementById("autoOrderBtn").addEventListener("click", autoOrder);
document.getElementById("tripStartInput").addEventListener("change", e => {
  state.tripStart = /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) ? e.target.value : "";
  saveLS();
});
document.getElementById("clearTripBtn").addEventListener("click", () => { state.trip = []; saveLS(); renderTrip(); render(); });
document.getElementById("makeRoadbookBtn").addEventListener("click", openRoadbook);
document.querySelectorAll(".overlay").forEach(ov => {
  ov.addEventListener("click", e => {
    if (e.target === ov || e.target.closest("[data-close]")) ov.classList.remove("show");
  });
});
addEventListener("keydown", e => {
  if (e.key === "Escape") document.querySelectorAll(".overlay.show").forEach(o => o.classList.remove("show"));
});

/* ================= 启动 ================= */
function boot() {
  loadLS();
  document.getElementById("tripStartInput").value = state.tripStart;
  document.getElementById("countPill").textContent = `🗺 ${DATA.filter(d => !d.stops).length} 个目的地 · ${DATA.filter(d => d.stops).length} 条线路 · 现在是${CUR_SEASON}天`;
  buildConsole();
  render();
  checkShareHash();
}
addEventListener("hashchange", checkShareHash); // 页面开着时粘贴迁移链接也能触发导入条

(async () => {
  try {
    DATA = await loadData();
  } catch (e) {
    document.body.insertAdjacentHTML("afterbegin",
      `<div style="padding:16px;text-align:center;color:#ef6461">数据加载失败，请刷新重试</div>`);
    throw e;
  }
  boot();
})();

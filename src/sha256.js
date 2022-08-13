const crypto = require("crypto")

function sha256(imageData) {
    return crypto
        .createHash("sha256")
        .update(Buffer.from(imageData.data.buffer))
        .digest("hex");
}

exports.sha256 = sha256
const {shrinkImage, toGreyscale} = require("../common")

function intensity1024(image, imageData) {
    const shrunk = shrinkImage(image, imageData, 32)
    return Array.from(toGreyscale(shrunk))
}

exports.intensity1024 = intensity1024
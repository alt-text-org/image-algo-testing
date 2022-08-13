const {shrinkImage, toGreyscale} = require("../common")

function average(arr) {
    const sum = arr.reduce((a, b) => a + b, 0)
    return sum / arr.length
}

function reduceToBinary(arr, avg) {
    return arr.map(val => val > avg ? 1 : 0)
}

function pHash1024(image, imageData) {
    const shrunk = shrinkImage(image, imageData, 32)
    const greyScale = toGreyscale(shrunk)
    const avg = average(greyScale)
    return Array.from(reduceToBinary(greyScale, avg))
}

exports.pHash1024 = pHash1024
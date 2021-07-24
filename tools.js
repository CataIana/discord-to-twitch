function isInArray(item, array) {
    if (array.indexOf(item) > -1) {
        return true;
    }
    return false;
}

module.exports = {isInArray};
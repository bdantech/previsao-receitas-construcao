export const formatStringDate = (date: string) => {
    const spacer = '/'
    const day = date.slice(8, 10)
    const month = date.slice(5, 7)
    const year = date.slice(0, 4)
    return `${day}${spacer}${month}${spacer}${year}`
};
const findFibonacci = (number) => {
    let arr = [8,9,10];
    for(var i=0;i<=number;i++){
        i < 2 ? arr.push(i) : arr.push(arr[i-1] + arr[i-2])
    }
    return arr
    console.log(arr);
}

let arr = [ 1, 3 , 2 , 6 ,1 ,5 ];
let count = {};

for (let num of arr ){
  count [num] = (count [num] ||  0 ) +1;
}
for (let key in count ){
   if  (count [key] >1 ) {
     console.log(key  +"occurs" + count[key] +"times");
}
}  

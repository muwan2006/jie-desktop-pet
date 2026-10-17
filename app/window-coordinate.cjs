'use strict';
function pixel(value){
 if(!Number.isFinite(value))throw RangeError('Invalid window coordinate');
 const rounded=Math.round(value);
 if(rounded<-2147483648||rounded>2147483647)throw RangeError('Window coordinate out of range');
 // V8 keeps -0 after rounding small negative positions. Electron's integer
 // binding rejects it; normalize at the native boundary, not in animation math.
 return rounded===0?0:rounded;
}
module.exports={pixel};

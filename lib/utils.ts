import { enableMapSet, produce } from "immer";
//-----------------------------------------
// FUNCTIONAL PARADIGM FUNCTIONS
//-------------------------------------------

/**
 * @author Antony Lao (copied from Ian Grubb)
 * @ex ```
       const multiple = (x, y) => x * y
       const value = pipe(2).to(multiply, 3) // x is the piped 2, y is 3
                            .value           // => 6
 *     ```
 * @param value 
 * @returns an object with key `value`, which contains the value transformed, 
 *   and a key `to` to use to pipe the functions
 * @note: use `.value` at the end of the pipeline to get the value back at the end
 * ```
 * ```
 * @last update: 19/07/2024; verified: 19/07/2024; tested: NO (simple enough)
 */
export const pipe = value => ({
  value,
  to: (fn, ...args) => pipe(fn(value, ...args))
})

//------------------------------
// CONCURRENCY PRIMITIVES (MODIFY THE ORDERING AND REPETITION OF FUNCTION CALLS) 
//--------------------------------

/**
 * @author Antony Lao
 * @description return a new function behaving as the original, but only applies 
 *   the function once
 * @notes the returned function return the same value as the original on first call, then
 *   returns `undefined`
 * @param fn : function passed (without any arguments)
 * @returns new function, which can only be applied once 
 * @last update: 19/07/2024; verified: 19/07/2024; tested: YES
 */
export function justOnce(fn: Function) {
  let alreadyCalled = false;

  return function (...args) {
    if (alreadyCalled) return
    alreadyCalled = true;
    return fn(...args)
  }
}

/**
 * @author Antony Lao
 * @description useful to coordinate parallel async calls by calling a callback function only when
 *   all async calls are finished
 * @use: ```const done = cut(3, doWhenEveryAsyncCallAreDone) 
 *          async function fn1(..args1) {
 *            ajax_call.then(() => done())
 *            ajax_call2.then(() => done())
 *          }```
 * @param limit : number of times to call the function returned by cut(), before calling callback()
 * @param callback : function called after n calls to function returned by cut()
 * @returns undefined
 * @last update: 19/07/2024; verified: 19/07/2024; tested: YES
 */
export function cut(limit: number, callback: Function) {
  let calls_finished = 0;

  return function () {
    calls_finished += 1;
    if (calls_finished === limit) callback()
  }
}

//------------------------------
// GENERAL DATA STRUCTURES HELPERS
//--------------------------------
// from JS docs
// Sequence generator function (commonly referred to as "range", e.g. Clojure, PHP, etc.)
export const range = (start: number, stop: number, step: number = 1): number[] =>
  Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + i * step);

/**
 * @author Antony Lao
 * @description returns a new Map. The return value of `fn` becomes a key in the Map, and 
 *   the value is the count of the elements of the struct for which applying the function returns the same thing
 * @note available for array, map, set (every data structure that have a `forEach` method).
 *   BUILT-IN OBJECT DOESN'T HAVE A BUILT-IN FOREACH METHOD!
 * @ex ``` countBy(myMap, (v,k) => {return v % 2 === 0})```
 * @last update: 20/07/2024; verified: 20/07/2024; tested: YES
 */
export function countBy(struct: Map<any, any> | Set<any> | Array<any>, fn: Function) {
  let ret = new Map()
  struct.forEach((...args) => {
    let key = fn(...args);
    ret.get(key) !== undefined ? ret.set(key, ret.get(key) + 1) : ret.set(key, 1)
  })
  return ret
}

/**
 * @author Antony Lao
 * @description returns a new Map. The return value of `fn` becomes a key in the Map, and 
 *   the value is the grouping of the struct values for which applying the function returns the same thing
 * @note available for array, map, set (every data structure that have a `forEach` method).
 *   BUILT-IN OBJECT DOESN'T HAVE A BUILT-IN FOREACH METHOD!
 * @ex ``` countBy(myMap, (v,k) => {return v % 2 === 0})```
 * @last update: 20/07/2024; verified: 20/07/2024; tested: YES
 */
export function groupBy(struct: Map<any, any> | Set<any> | Array<any>, fn: Function) {
  let ret = new Map()
  struct.forEach((...args) => {
    let key = fn(...args);
    let val;
    //NB: in each case below, we mutate the value associated to the key of ret if the key exists
    if (struct instanceof Map) {
      //by default, the map arguments with forEach are (val, key)
      val = args.slice(0, 2).reverse() //we want the args in the "intuitive" order (key, val) 
      ret.get(key) !== undefined ? ret.get(key).set(val[0], val[1]) : ret.set(key, new Map([val]))
    } else if (struct instanceof Set) {
      val = args[0]
      ret.get(key) !== undefined ? ret.get(key).add(val) : ret.set(key, new Set([val]))
    } else {
      val = args[0]
      ret.get(key) !== undefined ? ret.get(key).push(val) : ret.set(key, [val])
    }
  })
  return ret
}

/**
 * @author Antony Lao
 * @description convert a struct (Map/Set/obj) to array, apply f to the the array, then convert it back to original struct.
 *   permits to leverage Array methods on the struct 
 * @note: doesn't work on built-in objects
 * @ex 
 * ```
 * withArraySwap(myMap, (arr) => {<perform operations an array>})
 * ```
 * @param Or_MapSetObj
 * @param f : function with the array from struct as a parameter 
 * @returns new struct
 * @last update: 20/07/2024; verified: 20/07/2024; tested: NO (simple enough)
 */
export function withArraySwap(Or_MapSetObj: Map<any, any> | Set<any>, f: Function) {
  let arrFromStruct = Array.from(Or_MapSetObj)

  let arrTransformed = f(arrFromStruct)

  if (Or_MapSetObj instanceof Set) {
    return new Set(arrTransformed)
  } else if (Or_MapSetObj instanceof Map) {
    return new Map(arrTransformed)
  }
}



//-----------------------------------------
// HELPERS FOR IMMUTABLES (WITH IMMER)
//------------------------------------------

/**
 * @author: Antony Lao
 * @description: copy-on-write function, using Immer library
 * @Warning: if you mutate state of other objects inside the changeFn, it will mutate those objects for real!
 * @ex
 * ```
 * let obj = {x:5}; let updatedObj = copyOnWrite(obj, draft => {draft.x = 1})
 * ```
 * @notes inside the fn body, the object is a draft object. 
 *   For debugging, transform the draft to objects, use `current(<draft>)`. 
 *   It is possible to return a new data using `return` in the callback, but ONLY 
 *   if you didn't modify the draft.
 * @param obj : can be any array or plain object, Map or Set.
 *   For object from user-defined classes, add `[immerable] = true` in the class definition
 * @param changeFn : you can use in the function any mutative method on the object, it will not modify it
 * @returns the copy-on-write object
 * @last update: 19/07/2024; verified: 19/07/2024; tested: NO (I trust the Immer library)
 */
export function copyOnWrite(obj: any, changeFn: Function) {
  //import { current, enableMapSet, produce } from "immer";
  enableMapSet()
  return produce(obj, changeFn);
}

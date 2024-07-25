import { addHour, addMinute, addSecond, format, parse } from "@formkit/tempo";
import { castDraft, current, Draft, enableMapSet, produce, setAutoFreeze } from "immer";

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
// CONCURRENCY PRIMITIVES (MODIFY THE ORDERING (for async) AND REPETITION OF FUNCTION CALLS) 
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
 * @param obj 
 * @returns 
 */
export function toType(obj: any) {
  return Object.prototype.toString.call(obj).toString()
}

/**
 * @description: checks if the obj passed is a literal or a custom object
 * @source https://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
 * @note doesn't give false positives for: null, undefined, array, new Date()
 * @param obj 
 * @returns  
 * @last update: 22/07/2024; verified: 22/07/2024; tested: NO (simple enough)
 */
export function isObject(obj: any) {
  return toType(obj) === "[object Object]"
}

//we initialize reduce with `null` in the case of empty array: no error and returns null
export const min = function (arr: Array<any>, pluck: Function = (x) => x) {
  return arr.reduce((min, x) => min && pluck(min) < pluck(x) ? min : x, null)
}

export const max = function (arr: Array<any>, pluck: Function = (x) => x) {
  return arr.reduce((max, x) => max && pluck(max) > pluck(x) ? max : x, null)
}

//CONVERTING MAP/SET TO/FROM OBJ/ARRR
export function arrToSet<T>(arr: Array<T>) {
  return new Set(arr)
}

export function setToArr<T>(setStruct: Set<T>) {
  return Array.from(setStruct)
}

export function mapToObj<T, K>(mapStruct: Map<T, K>): { string: K } {
  return Object.fromEntries(mapStruct)
}

/**
 * 
 * @param obj : NOT TYPECHECKED!
 * @returns 
 */
export function objToMap(obj: Object) {
  return new Map(Object.entries(obj));
}

// interface Test {
//   "a": number
// }
// let obj: Test = { a: 45 }
// let mySet = new Set([1, 2, 3])
// let vanillaReturned = new Map(Object.entries(obj))
// let returned = mapToObj(new Map<number | string, number | string>([[1, 3], ["b", 2]]))


/**
 * @author Antony Lao
 * @description returns a new Map. The return value of `fn` becomes a key in the Map, and 
 *   the value is the count of the elements of the struct for which applying the function returns the same thing
 * @note available for array, map, set, object (literal or custom), but NO TYPECHECKING on struct 
 * @ex ``` countByWithMap(myMap, (v,k) => {return v % 2 === 0})```
 * @last update: 22/07/2024; verified: 22/07/2024; tested: YES
 */
export function countByWithMap(struct: any, fn: Function) {
  let ret: Map<any, number> = new Map()
  if (isObject(struct)) {
    struct = Object.entries(struct)
  }
  struct.forEach((...args) => {
    let key = fn(...args); // we take the arguments from the #forEach method on struct, and put them on our fn
    ret.get(key) !== undefined ? ret.set(key, ret.get(key) + 1) : ret.set(key, 1)
  })
  return ret
}

/**
 * @author Antony Lao
 * @description returns a new literal object. The return value of `fn` becomes a key in the object, and 
 *   the value is the count of the elements of the struct for which applying the function returns the same thing
 * @note available for array, map, set, object (literal or custom), but NO TYPECHECKING on struct 
 * @ex ``` countByWithObj(myMap, (v,k) => {return v % 2 === 0})```
 * @last update: 22/07/2024; verified: 22/07/2024; tested: YES
 */
export function countByWithObj(struct: any, fn: Function) {
  let ret: Record<any, number> = {}
  if (isObject(struct)) {
    struct = Object.entries(struct)
  }
  struct.forEach((...args) => {
    let key = fn(...args)
    ret[key] !== undefined ? ret[key] += 1 : ret[key] = 1
  })
  return ret
}

/**
 * @author Antony Lao
 * @description returns a new Map. The return value of `fn` becomes a key in the Map, and 
 *   the value is the grouping of the struct values for which applying the function returns the same thing.
 *   The grouping are of the same type as the struct
 * @warning: fn and fnOnEltsGrouped can mutate stuff, in particular the struct passed!
 * @note available for array, map, set, object (literal or custom), but NO TYPECHECKING on struct 
 * @note on custom objects, the groupings values are literal objects
 * @ex ``` groupBy(myMap, (v,k) => {return v % 2 === 0})```
 * @last update: 25/07/2024; verified: 25/07/2024; tested: YES
 * 
 */
export function groupByWithMap(struct: any, fn: Function, fnOnEltsGrouped: Function = (x) => x) {
  let ret = new Map()

  let newStruct;
  if (isObject(struct)) {
    newStruct = Object.entries(struct) //convert it to a Map
  } else {
    newStruct = struct
  }
  newStruct.forEach((...args) => {
    let retKey = fn(...args);
    let val;
    //NB: in each case below, we mutate the value associated to the key of ret if the key exists
    //we check against the type of the original struct, not newStruct
    if (isObject(struct)) {
      val = args[0]
      const finalVal = fnOnEltsGrouped(val)
      const [structKey, structVal] = [finalVal[0], finalVal[1]]
      //original: const [structKey, structVal] = [val[0], val[1]]
      ret.get(retKey) !== undefined ? ret.get(retKey)[structKey] = structVal : ret.set(retKey, { [structKey]: structVal })
    } else if (struct instanceof Map) {
      //by default, the map arguments with forEach are (val, key)
      val = args.slice(0, 2).reverse() //we want the args in the "intuitive" order (key, val) 
      const finalVal = fnOnEltsGrouped(val) //the function applies to a tuple [k, v], like for literal objects
      const [structKey, structVal] = [finalVal[0], finalVal[1]]
      //original const [structKey, structVal] = [val[0], val[1]]
      ret.get(retKey) !== undefined ? ret.get(retKey).set(structKey, structVal) : ret.set(retKey, new Map([[structKey, structVal]]))

    } else if (struct instanceof Set) {
      val = args[0]
      const finalVal = fnOnEltsGrouped(val)
      ret.get(retKey) !== undefined ? ret.get(retKey).add(finalVal) : ret.set(retKey, new Set([finalVal]))
    } else if (struct instanceof Array) {
      val = args[0]
      const finalVal = fnOnEltsGrouped(val)
      ret.get(retKey) !== undefined ? ret.get(retKey).push(finalVal) : ret.set(retKey, [finalVal])
    }
  })
  return ret
}

/**
 * @author Antony Lao
 * @description returns a new literal object. The return value of `fn` becomes a key in the object, and 
 *   the value is the grouping of the struct values for which applying the function returns the same thing.
 *   Another optional function can be used to change the elts grouped
 *   The grouping are of the same type as the struct
 * @warning: fn and fnOnEltsGrouped can mutate stuff, in particular the struct passed!
 * @note available for array, map, set, object (literal or custom), but NO TYPECHECKING on struct 
 * @note on custom objects, the groupings values are literal objects
 * @ex ``` groupBy(myMap, (v,k) => {return v % 2 === 0})```
 * @last update: 25/07/2024; verified: 25/07/2024; tested: YES
 * 
 */
export function groupByWithObj(struct: any, fn: Function, fnOnEltsGrouped: Function = (x) => x) {
  const ret: Record<any, any> = {}

  let newStruct;
  if (isObject(struct)) {
    newStruct = Object.entries(struct) //convert it to a Map
  } else {
    newStruct = struct
  }
  newStruct.forEach((...args) => {
    let retKey = fn(...args);
    let val;
    //NB: in each case below, we mutate the value associated to the key of ret if the key exists
    //we check against the type of the original struct, not newStruct
    if (isObject(struct)) {
      val = args[0];
      const finalVal = fnOnEltsGrouped(val)
      const [structKey, structVal] = [finalVal[0], finalVal[1]]
      ret[retKey] !== undefined ? ret[retKey][structKey] = structVal : ret[retKey] = { [structKey]: structVal }
    } else if (struct instanceof Map) {
      //by default, the map arguments with forEach are (val, key)
      val = args.slice(0, 2).reverse() //we want the args in the "intuitive" order (key, val) 
      const finalVal = fnOnEltsGrouped(val) //the function applies to a tuple [k, v], like for literal objects
      const [structKey, structVal] = [finalVal[0], finalVal[1]]
      ret[retKey] !== undefined ? ret[retKey].set(structKey, structVal) : ret[retKey] = new Map([[structKey, structVal]])
    } else if (struct instanceof Set) {
      val = args[0]
      const finalVal = fnOnEltsGrouped(val)
      ret[retKey] !== undefined ? ret[retKey].add(finalVal) : ret[retKey] = new Set([finalVal])
    } else if (struct instanceof Array) {
      val = args[0]
      const finalVal = fnOnEltsGrouped(val)
      // console.log("🚀 ~ newStruct.forEach ~ val:", val)

      ret[retKey] !== undefined ? ret[retKey].push(finalVal) : ret[retKey] = [finalVal]
    }
  })
  return ret
}

/**
 * @description: creates an object from two arrays: an array of keys, and an array of values.
 *   Takes the array of keys to iterate, so if the `values` array is shorter, undefined are the default 
 *   for the remaining keys
 * @last updated: 25/07/2024; verified: 25/07/2024
 */
export function createObjFrom(keys, values) {
  return keys.reduce((obj, key, idx) => {
    obj[key] = values[idx]
    return obj
  }, {})
}

// const myObj = { key: 'a', aName: 'b', price: undefined, quantity: undefined }
// const newObj = extractKeyFromObj(myObj)
// console.log("🚀 ~ newObj:", newObj)

/**
 * @description creates an object from an array of objects having each a `key` key
 * @note somewhat specialized function. Maybe later add functionnality with Map and Set? 
 * @param arr : array of objects, each with a `key` key
 * @uses copyOnWrite(I.e immer)
 */
export function extractKeysFrom(arr: Array<{ key: any }>) {
  return groupByWithObj(arr, (v) => v.key,
    (v) => { return copyOnWrite(v, v => { delete v.key }) })
}
/**
 * @author Antony Lao
 * @description convert a struct (Map/Set/obj) to array, apply f to the the array, then convert it back to original struct.
 *   permits to leverage Array methods on the struct 
 * @note: doesn't work on literal objects. not mutative
 * @note if struct is not a Map, a Set or an object (literal or custom), RETURN THE ORIGINAL struct 
 * @ex 
 * ```
 * withArraySwap(myMap, (arr) => {return <perform operations on array>})
 * ```
 * @param struct
 * @param f : function with the array from struct as a parameter 
 * @returns new struct
 * @last update: 20/07/2024; verified: 20/07/2024; tested: NO (TODO)
 */
export function withArraySwap(struct: Map<unknown, unknown> | Set<unknown> | Record<string | symbol, any>, f: Function) {
  let arrFromStruct;
  if (isObject(struct)) {
    arrFromStruct = Object.entries(struct)
  } else if (struct instanceof Map || struct instanceof Set) {
    arrFromStruct = Array.from(struct)
  } else {
    return struct
  }

  let arrTransformed = f(arrFromStruct)

  if (struct instanceof Set) {
    return new Set(arrTransformed)
  } else if (struct instanceof Map) {
    return new Map(arrTransformed)
  } else if (isObject(struct)) {
    return Object.fromEntries(arrTransformed)
  }
}

//MANUAL TESTS
// const myMap = new Map([['a', 1], ["b", 2]])
// const newMap = withArraySwap(myMap, (arr) => {
//   return arr.filter(([k, v]) => { return v % 2 === 0 })
// })
// // console.log("🚀 ~ newMap ~ newMap:", newMap)

// const myObj = { "a": 1, "b": 2 }
// const newObj = withArraySwap(myObj, (arr) => {
//   return arr.filter(([k, v]) => { return v % 2 === 0 })
// })
// console.log("🚀 ~ newObj ~ newObj:", newObj)
/**
 * @author Antony Lao
 * source: https://ebeced.com/blog/ts-best-practices/using-map#utils-javalike-putifabsent
 * modified implementation: doesn't work with keys of map not being a primitive types
 * not mutative
 */
//TODO add a elseFn param to define what to do if the key is present
export function addToMapIfKeyAbsent<T, K>(mapStruct: Map<T, K>, newKey: T, value: K) {

  const keyExists = Array.from(mapStruct.keys()).find(existingKey => {
    return existingKey === newKey
  })

  //<arr>.find() returns undefined if there is no match
  if (keyExists === undefined) {
    return copyOnWrite(mapStruct, draft => {
      draft.set(castDraft(newKey), castDraft(value)) //castDraft is a immer function, used to make the Draft type error disappear

    })
  }

  return mapStruct
}

//MANUAL TESTS
// const myMap = new Map([["a", 1]])
// const myMapModif = addIfKeyAbsent(myMap, "b", 2)
// console.log("🚀 ~ myMap:", myMap)
// console.log("🚀 ~ myMapModif:", myMapModif)


/**
 * @author Antony Lao
 * @description: use with literal object
 * @note use copy-on-write: not mutative
 * @Warning: obj NOT TYPECHECKED
 */
//TODO add a elseFn param to define what to do if the key is present
export function addToObjIfKeyAbsent<T>(obj: T, newKey: string | symbol, value: any) {
  const keyExists = pipe(obj)
    .to(Object.keys).value
    .find(existingKey => {
      return existingKey === newKey
    })

  //<arr>.find() returns undefined if there is no match
  if (keyExists === undefined) {
    return copyOnWrite(obj, draft => {
      draft[newKey] = value
    })
  }
  return obj
}

//MANUAL TESTS
// type myObjType = {
//   "a": number
// }
// const myObj: myObjType = { "a": 1 }
// const myObj2 = addToObjIfKeyAbsent(myObj, "b", "b")
// console.log("🚀 ~ myObj2:", myObj2)

// export function getIdxFromValue(arr: Array<any>, value) {
//   let keysArr = range(0, arr.length - 1)
//     .filter((idx) => { return arr[idx] === value })

//   return new Set(keysArr)
// }

/**
 * @author: Antony Lao
 * @param obj_like : Map or literal object (NOT TYPECHECKED)
 * @param value : value to find the keys from
 * @returns Set of keys
 */
export function getKeysFromValue(obj_like, value) {
  let keysArr;
  if (isObject(obj_like)) {
    keysArr = Object.keys(obj_like).filter(key => obj_like[key] === value);
  }
  if (obj_like instanceof Map) {
    keysArr = pipe(obj_like.keys())
      .to(Array.from).value
      .filter(key => obj_like.get(key) === value);
  }
  return new Set(keysArr)
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
// rewrote function signature to have the correct return types https://github.com/immerjs/immer/issues/787 
export function copyOnWrite<T>(obj: T, changeFn: (draft: Draft<T>) => Draft<T> | void) {
  //import { current, enableMapSet, produce } from "immer"
  enableMapSet()
  return produce(obj, changeFn);
}

class ExperimentalCopyOnWrite {
  //experimental
  /**
   * @description
   * @param obj : a literal object or an array
   * @param keys array of keys
   * @param changeFn : function which takes a shallow copy of obj and mutates it
   *   
   */
  static handmadeCopyOnWrite(obj: any, changeFn: Function) {
    function shallowCopy(obj) {
      let copy;
      if (isObject(obj)) {
        return Object.assign({}, obj)
      }
      if (obj instanceof Array) {
        return obj.slice()
      }
    }

    let copy = shallowCopy(obj)
    changeFn(copy)
    return copy
  }

  /**
   * @description
   * @param obj : a literal object or an array
   * @param key 
   * @param changeFnOnKey : function should return the new value of obj[key] WITHOUT multating it
   * @uses handmadeCopyOnWrite
   */
  static modifyKey(obj: any, key: any, changeFnOnKey: any) {
    return this.handmadeCopyOnWrite(obj, (obj) => obj[key] = changeFnOnKey(obj[key]))
  }
  /**
   * @description
   * @param obj : a literal object or an array
   * @param keys: array of keys: order is from less to most nested keys 
   * @param changeFnOnKey : function should return the new value of obj[key] WITHOUT multating it
   * @uses handmadeCopyOnWrite, modifyKey
   */
  static modifyNestedKey(obj: any, keys: Array<any>, changeFnOnKey: any) {
    if (keys.length === 0) {
      return changeFnOnKey(obj)
    }
    let first_key = keys[0]
    let remaining_keys = keys.slice(1)
    return this.modifyKey(obj, first_key, (x) => {
      return this.modifyNestedKey(x, remaining_keys, changeFnOnKey)
    })
  }

}
// const nested_obj = { "nested": "object" }
// const obj = { "a": nested_obj, "b": 2 }

// const objModified = ExperimentalCopyOnWrite.modifyNestedKey(obj, ["a", "nested"], (x) => "modified")
// p(obj)
// p(objModified)
//-----------------------------------------
// MATH HELPERS
//------------------------------------------

//types used for function signatures
type roundParams = {
  num: number,
  nbOfFloatDigits?: number
}

type meanParams = {
  arr: Array<number>;
  rounded?: boolean
  nbOfFloatDigits?: number;
}
const sum = (arr) => {
  return arr.reduce((acc: number, currentValue: number) => {
    return acc + currentValue
  })
}

export const mean = ({ arr, rounded = true, nbOfFloatDigits = 2 }: meanParams) => {
  if (arr.length === 0) {
    return 0;
  }


  //this does floating point division because JS doesn't have separation between int/float
  let meanNum = sum(arr) / arr.length
  if (rounded) {
    return round({ num: meanNum, nbOfFloatDigits })
  } else {
    return meanNum
  }
}

export function round({ num, nbOfFloatDigits = 2 }: roundParams) {
  const multiplicator = 10 ** nbOfFloatDigits
  //Math.round returns an integer
  return Math.round(num * multiplicator) / multiplicator
}



//-----------------------------------------
// STRING HELPERS
//------------------------------------------

export function stringToRegExp(str: string) {
  function escapeRegExp(str: string) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  str = escapeRegExp(str);
  return new RegExp(str, 'ig');
}

//removes trailing whitespaces between words, and at the beginning and end
export function normalizeString(str: string) {
  return str.trim().split(/ {1,}/).join(' ')
}


//-----------------------------------------
// DATE & TIME HELPERS (WITH TEMPO)
//------------------------------------------

//time like "13:52:32"
export function formatTime(timeStr: string) {
  return format(parse(timeStr, "hh:mm:ss"), { time: "short" }, "fr")
}

//str like 2025-03-26T13:53:02.000Z
export function formatDateTimeFullVersion(date: string | Date): string {
  return format(date, { date: "full", time: "short" }, "fr")
}

export function formatDateTimeShortVersion(date: string | Date): string {
  return format(date, { date: "short", time: "short" }, "fr")
}

// duration is in format "hh:mm:ss"
export function addToDate(date: Date, duration: string) {
  const durationHoursMinsSecs = duration.split(':').map((str) => +str)
  date = addHour(date, durationHoursMinsSecs[0])
  date = addMinute(date, durationHoursMinsSecs[1])
  date = addSecond(date, durationHoursMinsSecs[2])
  return date
}

// format strDatetime: "2024-03-20T17:02:32.000Z"
export function getDateAndTimeStruct(strDatetime: string): { date: string, time: string } {
  const dateTimeSplit = strDatetime.split(/[T.]/)
  return { date: dateTimeSplit[0], time: dateTimeSplit[1] }
}

//-----------------------------------------
// DEBUG TOOLS
//------------------------------------------

export function p(obj, prefix = "print", suffix = "endPrint", depth = 99) {
  console.log("🔔🚀 ~ " + prefix)
  console.dir(obj, { depth })
  // console.log("🚀🔔 ~ " + suffix)
}
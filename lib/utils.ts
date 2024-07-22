import { addHour, addMinute, addSecond, format, parse } from "@formkit/tempo";
import { current, Draft, enableMapSet, produce, setAutoFreeze } from "immer";
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
const min = function (arr: Array<any>, pluck: Function = (x) => x) {
  return arr.reduce((min, x) => min && pluck(min) < pluck(x) ? min : x, null)
}

const max = function (arr: Array<any>, pluck: Function = (x) => x) {
  return arr.reduce((max, x) => max && pluck(max) > pluck(x) ? max : x, null)
}

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
 * @note available for array, map, set, object (literal or custom), but NO TYPECHECKING on struct 
 * @note on custom objects, the groupings values are literal objects
 * @ex ``` groupBy(myMap, (v,k) => {return v % 2 === 0})```
 * @last update: 22/07/2024; verified: 22/07/2024; tested: YES
 * 
 */
export function groupByWithMap(struct: any, fn: Function) {
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
      const [structKey, structVal] = [val[0], val[1]]
      ret.get(retKey) !== undefined ? ret.get(retKey)[structKey] = structVal : ret.set(retKey, { [structKey]: structVal })
    } else if (struct instanceof Map) {
      //by default, the map arguments with forEach are (val, key)
      val = args.slice(0, 2).reverse() //we want the args in the "intuitive" order (key, val) 
      const [structKey, structVal] = [val[0], val[1]]
      ret.get(retKey) !== undefined ? ret.get(retKey).set(structKey, structVal) : ret.set(retKey, new Map([[structKey, structVal]]))

    } else if (struct instanceof Set) {
      val = args[0]
      ret.get(retKey) !== undefined ? ret.get(retKey).add(val) : ret.set(retKey, new Set([val]))
    } else if (struct instanceof Array) {
      val = args[0]
      ret.get(retKey) !== undefined ? ret.get(retKey).push(val) : ret.set(retKey, [val])
    }
  })
  return ret
}

/**
 * @author Antony Lao
 * @description returns a new literal object. The return value of `fn` becomes a key in the object, and 
 *   the value is the grouping of the struct values for which applying the function returns the same thing.
 *   The grouping are of the same type as the struct
 * @note available for array, map, set, object (literal or custom), but NO TYPECHECKING on struct 
 * @note on custom objects, the groupings values are literal objects
 * @ex ``` groupBy(myMap, (v,k) => {return v % 2 === 0})```
 * @last update: 22/07/2024; verified: 22/07/2024; tested: YES
 * 
 */
export function groupByWithObj(struct: any, fn: Function) {
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
      const [structKey, structVal] = [val[0], val[1]]
      ret[retKey] !== undefined ? ret[retKey][structKey] = structVal : ret[retKey] = { [structKey]: structVal }
    } else if (struct instanceof Map) {
      //by default, the map arguments with forEach are (val, key)
      val = args.slice(0, 2).reverse() //we want the args in the "intuitive" order (key, val) 
      const [structKey, structVal] = [val[0], val[1]]
      ret[retKey] !== undefined ? ret[retKey].set(structKey, structVal) : ret[retKey] = new Map([[structKey, structVal]])
    } else if (struct instanceof Set) {
      val = args[0]
      ret[retKey] !== undefined ? ret[retKey].add(val) : ret[retKey] = new Set([val])
    } else if (struct instanceof Array) {
      val = args[0]
      ret[retKey] !== undefined ? ret[retKey].push(val) : ret[retKey] = [val]
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


/**
 * source: https://ebeced.com/blog/ts-best-practices/using-map#utils-javalike-putifabsent
 * modified implementation: doesn't work with keys of map not being a primitive types
 */
export function putIfAbsent<T>(map: Map<T, string>, newMember: T, value: string) {
  const isUniqueKey = Array.from(map.keys()).find(existingMember => {
    return existingMember === newMember
  })

  if (!isUniqueKey) {
    map.set(newMember, value)
  }
}

//TODO: putIfAbsent for object ? maybe easy enough?


//TODO: getKeysFromValue for Map (& Arr)
/**
 * @author: Antony Lao
 * @param obj : literal object (NOT TYPECHECKED)
 * @param value : value to find the keys from
 * @returns list of keys
 */
export function getObjKeysFromValue(obj, value) {
  return Object.keys(obj).filter(key => obj[key] === value);
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

export const mean = ({ arr, rounded = true, nbOfFloatDigits = 2 }: meanParams) => {
  if (arr.length === 0) {
    return 0;
  }

  const sum = arr.reduce((acc: number, currentValue: number) => {
    return acc + currentValue
  })

  //this does floating point division because JS doesn't have separation between int/float
  let meanNum = sum / arr.length
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

//helper for stringToRegExp: don't export
function escapeRegExp(str: string) {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function stringToRegExp(str: string) {
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
export function getDateAndTime(strDatetime: string): { date: string, time: string } {
  const dateTimeSplit = strDatetime.split(/[T.]/)
  return { date: dateTimeSplit[0], time: dateTimeSplit[1] }
}
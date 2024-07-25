import { beforeEach, describe, expect, it, test } from '@jest/globals';
import { countByWithMap, countByWithObj, cut, extractKeysFrom, groupByWithMap, groupByWithObj, justOnce, toType } from './utils';
import { produce } from 'immer';

//NOTES: use toStrictEqual to compare object values, not toMatchObject
//toStrictEqual do not always check the types on the keys  of Map ( check groupByWithMap_onObj: not able to reproduce simply)? 
describe("immer produce function interesting gotchas", () => {
  it("issues when nested 1", () => {
    const innerReducer = produce((draft) => {
      draft.foo = 'bar';
    });

    const badOuterReducer = produce((draft) => {
      innerReducer(draft); //returns a new object, not affecting the outer draft
    });

    const goodOuterReducer = produce((draft) => {
      return innerReducer(draft); //we tell immer to replace object with the return value, even if draft wasn't mutated
    });

    const state = { foo: 'foo' };

    expect(badOuterReducer(state)).toEqual({ foo: 'foo' })
    expect(goodOuterReducer(state)).toEqual({ foo: 'bar' })
  })

  it("issues when nested 2", () => {
    const base = { x: 1 }

    const p1 = produce(s => {
      s.x++
    })

    const p2 = produce(s => {
      s.x++
      s = p1(s) //doesn't work
      s.x++ // s != the draft here so this won't be seen by anyone
    })

    expect(p2(base)).toEqual({
      x: 2
    })
  })
})

describe("concurrency primitives function tests", () => {
  beforeEach(() => {
  });

  describe("justOnce()", () => {
    it("returns a new function which behaves like the original on first call,\
         but does not do anything on subsequent calls", () => {
      //setup
      const obj = { val: "initial" }  //obj is a global variable
      const mutateObj = (newVal: string) => {
        obj.val = newVal   //mutates global variable
      }

      const mutateObjOnce = justOnce(mutateObj)
      //apply 
      mutateObjOnce("new1")
      mutateObjOnce("new2")
      //test
      expect(obj.val).toBe("new1")
    })

    it("the new function returns the same value as the original,\
        then `undefined` on subsequent calls", () => {
      //setup
      const add = (x: number, y: number) => {
        return x + y;
      }

      const addJustOnce = justOnce(add);
      //apply and test
      expect(addJustOnce(1, 2)).toBe(add(1, 2));
      expect(addJustOnce(1, 2)).toBe(undefined);
    })
  })


  describe("cut()", () => {
    //setup for testing purposes
    function delay(milliseconds) {
      return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
      });
    }

    // skip this one in watch mode because it uses timeouts
    it.skip("returns a function that call a callback after it has been called n times", async () => {
      //setup
      let shared_var = "initial"
      const done = cut(2, () => shared_var = "callback_mutated_me")

      function mutate_shared_var_after_1() {
        setTimeout(() => { shared_var = "fn1_mutated_me"; done() }, 1000)
      }

      function mutate_shared_var_after_2() {
        setTimeout(() => { shared_var = "fn2_mutated_me"; done() }, 2000)
      }
      //apply
      mutate_shared_var_after_1();
      mutate_shared_var_after_2();  //both async functions run in parallel timelines
      //test
      expect(shared_var).toBe("initial")
      await delay(1000);
      expect(shared_var).toBe("fn1_mutated_me") //1 second later, first mutation happens
      await delay(1000);
      expect(shared_var).toBe("callback_mutated_me") //2 second later, second mutation happens, 
      // but at this point the callback from cut is also called
    })
  })
})

describe("builtin data structure function tests", () => {
  describe("countByWithMap()", () => {
    it("returns a Map instance", () => {
      const returnStruct = countByWithMap([], () => { })
      expect(toType(returnStruct)).toBe("[object Map]")

    })
    it("counts the number of instances where the function returns the same value", () => {
      //setup
      const myObj = { "a": 1, "b": 2, "c": 2, "d": 4 }
      class myClass {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const myCustomObj = new myClass(1, 2, 2, 4)
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 4)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply
      const countByWithMap_onObj = countByWithMap(myObj, ([k, v]) => { return v % 2 === 0 })
      const expected_onObj = new Map([[false, 1], [true, 3]]);

      const countByWithMap_onCustomObj = countByWithMap(myCustomObj, ([k, v]) => { return v % 2 === 0 })
      const expected_onCustomObj = new Map([[false, 1], [true, 3]])

      const countByWithMap_onMap = countByWithMap(myMap, (v, k) => { return v % 2 === 0 })
      const expected_onMap = new Map([[false, 1], [true, 3]]);

      const countByWithMap_onSet = countByWithMap(mySet, (v) => { return v % 2 === 0 })
      const expected_onSet = new Map([[false, 3], [true, 2]]);

      const countByWithMap_onArr = countByWithMap(myArr, (v) => { return v % 2 === 0 })
      const expected_onArr = new Map([[false, 3], [true, 2]]);

      //test
      expect(countByWithMap_onObj).toStrictEqual(expected_onObj)
      expect(countByWithMap_onCustomObj).toStrictEqual(expected_onCustomObj)
      expect(countByWithMap_onMap).toStrictEqual(expected_onMap)
      expect(countByWithMap_onSet).toStrictEqual(expected_onSet)
      expect(countByWithMap_onArr).toStrictEqual(expected_onArr)
    })

    it("doesn't mutate the struct passed in (not counting the passed function behavior)", () => {
      //setup
      const myObj = { "a": 1, "b": 2, "c": 2, "d": 4 }
      class myClass {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const myCustomObj = new myClass(1, 2, 2, 4)
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 4)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply
      const countByWithMap_onObj = countByWithMap(myObj, ([k, v]) => { return v % 2 === 0 })
      const countByWithMap_onCustomObj = countByWithMap(myCustomObj, ([k, v]) => { return v % 2 === 0 })
      const countByWithMap_onMap = countByWithMap(myMap, (v, k) => { return v % 2 === 0 })
      const countByWithMap_onSet = countByWithMap(mySet, (v) => { return v % 2 === 0 })
      const countByWithMap_onArr = countByWithMap(myArr, (v) => { return v % 2 === 0 })
      //(redefine original struct (expected values))
      const originalObj = { "a": 1, "b": 2, "c": 2, "d": 4 }
      class myClassCopy {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const originalCustomObj = new myClass(1, 2, 2, 4)
      const notOriginalCustomObj = new myClassCopy(1, 2, 2, 4)
      const originalMap = new Map()
      originalMap.set("a", 1).set("b", 2).set("c", 2).set("d", 4)
      let originalArr = [1, 2, 3, 4, 5]
      const originalSet = new Set(originalArr)
      //test
      expect(myObj).toStrictEqual(originalObj)
      expect(myCustomObj).toStrictEqual(originalCustomObj)
      //* jest does not have a way of expecting a test to not pass (test on next line)
      // expect(myCustomObj).toStrictEqual(notOriginalCustomObj).toBe(false)
      expect(myMap).toStrictEqual(originalMap)
      expect(mySet).toStrictEqual(originalSet)
      expect(myArr).toStrictEqual(originalArr)
    })

    it("implementation: works with values in returned Map being falsy values", () => {
      //* not possible because the values of the returned map start with 1, then incremented => values are always truthy
      //setup
      const myMap = new Map()
      myMap.set("a", "val")
      //apply
      const countBy_result = countByWithMap(myMap, (v, k) => { return "key" })
      const expected = new Map([["key", 1]])
      //test
      expect(countBy_result).toStrictEqual(expected)
    })
  })

  describe("countByWithObject()", () => {
    it("returns an literal object", () => {
      const returnStruct = countByWithObj([], () => { })
      expect(toType(returnStruct)).toBe("[object Object]")
    })

    it("counts the number of instances where the function returns the same value", () => {
      //setup
      const myObj = { "a": 1, "b": 2, "c": 2, "d": 4 }
      class myClass {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const myCustomObj = new myClass(1, 2, 2, 4)
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 4)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply
      const countByWithObj_onObj = countByWithObj(myObj, ([k, v]) => { return v % 2 === 0 })
      const expected_onObj = { false: 1, true: 3 };

      const countByWithObj_onCustomObj = countByWithObj(myCustomObj, ([k, v]) => { return v % 2 === 0 })
      const expected_onCustomObj = { false: 1, true: 3 }

      const countByWithObj_onMap = countByWithObj(myMap, (v, k) => { return v % 2 === 0 })
      const expected_onMap = { false: 1, true: 3 };

      const countByWithObj_onSet = countByWithObj(mySet, (v) => { return v % 2 === 0 })
      const expected_onSet = { false: 3, true: 2 };

      const countByWithObj_onArr = countByWithObj(myArr, (v) => { return v % 2 === 0 })
      const expected_onArr = { false: 3, true: 2 };
      //test
      expect(countByWithObj_onObj).toStrictEqual(expected_onObj)
      expect(countByWithObj_onCustomObj).toStrictEqual(expected_onCustomObj)
      expect(countByWithObj_onMap).toStrictEqual(expected_onMap)
      expect(countByWithObj_onSet).toStrictEqual(expected_onSet)
      expect(countByWithObj_onArr).toStrictEqual(expected_onArr)
    })

    it("doesn't mutate the struct passed in (not counting the passed function behavior)", () => {
      //setup
      const myObj = { "a": 1, "b": 2, "c": 2, "d": 4 }
      class myClass {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const myCustomObj = new myClass(1, 2, 2, 4)
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 4)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply
      const countByWithObj_onObj = countByWithObj(myObj, ([k, v]) => { return v % 2 === 0 })
      const countByWithObj_onCustomObj = countByWithObj(myCustomObj, ([k, v]) => { return v % 2 === 0 })
      const countByWithObj_onMap = countByWithObj(myMap, (v, k) => { return v % 2 === 0 })
      const countByWithObj_onSet = countByWithObj(mySet, (v) => { return v % 2 === 0 })
      const countByWithObj_onArr = countByWithObj(myArr, (v) => { return v % 2 === 0 })
      //(redefine original struct (expected values))
      const originalObj = { "a": 1, "b": 2, "c": 2, "d": 4 }
      class myClassCopy {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const originalCustomObj = new myClass(1, 2, 2, 4)
      const notOriginalCustomObj = new myClassCopy(1, 2, 2, 4)
      const originalMap = new Map()
      originalMap.set("a", 1).set("b", 2).set("c", 2).set("d", 4)
      //test
      expect(myObj).toStrictEqual(originalObj)
      expect(myCustomObj).toStrictEqual(originalCustomObj)
      let originalArr = [1, 2, 3, 4, 5]
      const originalSet = new Set(originalArr)
      //* jest does not have a way of expecting a test to not pass (test on next line)
      // expect(myCustomObj).toStrictEqual(notOriginalCustomObj).toBe(false)
      expect(myMap).toStrictEqual(originalMap)
      expect(mySet).toStrictEqual(originalSet)
      expect(myArr).toStrictEqual(originalArr)

    })


  })

  describe("groupByWithMap()", () => {
    it("returns a Map instance", () => {
      const returnStruct = countByWithMap([], () => { })
      expect(toType(returnStruct)).toBe("[object Map]")

    })

    it("group the number of instances where the function returns the same value", () => {
      //setup
      const myObj = { "a": 1, "b": 2, "c": 2, "d": 3 }
      class myClass {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const myCustomObj = new myClass(1, 2, 2, 3)
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 3)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply
      const groupByWithMap_onObj = groupByWithMap(myObj, ([k, v]) => { return v % 2 === 0 })
      const expected_onObj = new Map([
        [false, { a: 1, d: 3 }], [true, { b: 2, c: 2 }]
      ])

      const groupByWithMap_onCustomObj = groupByWithMap(myCustomObj, ([k, v]) => { return v % 2 === 0 })
      const expected_onCustomObj = new Map<any, Object>([
        [false, { a: 1, d: 3 }], [true, { b: 2, c: 2 }]
      ])

      const groupByWithMap_onMap = groupByWithMap(myMap, (v, k) => { return v % 2 === 0 })
      const expected_onMap = new Map([
        [false, new Map([["a", 1], ["d", 3]])],
        [true, new Map([["b", 2], ["c", 2]])]
      ]);

      const groupByWithMap_onSet = groupByWithMap(mySet, (v) => { return v % 2 === 0 })
      const expected_onSet = new Map([
        [false, new Set([1, 3, 5])],
        [true, new Set([2, 4])]
      ]);

      const groupByWithMap_onArr = groupByWithMap(myArr, (v) => { return v % 2 === 0 })
      const expected_onArr = new Map([[false, [1, 3, 5]], [true, [2, 4]]]);
      //test
      expect(groupByWithMap_onObj).toStrictEqual(expected_onObj)
      expect(groupByWithMap_onCustomObj).toStrictEqual(expected_onCustomObj)
      expect(groupByWithMap_onMap).toStrictEqual(expected_onMap)
      expect(groupByWithMap_onSet).toStrictEqual(expected_onSet)
      expect(groupByWithMap_onArr).toStrictEqual(expected_onArr)
    })
    it("optionnally applies a function to the values grouped", () => {
      //setup
      const myObj = { "a": 1, "b": 2, "c": 2, "d": 3 }
      class myClass {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const myCustomObj = new myClass(1, 2, 2, 3)
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 3)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply
      const groupByWithMap_onObj = groupByWithMap(myObj, ([k, v]) => { return v % 2 === 0 }, ([k, v]) => [k, v - 1])
      const expected_onObj = new Map([
        [false, { a: 1 - 1, d: 3 - 1 }], [true, { b: 2 - 1, c: 2 - 1 }]
      ])

      const groupByWithMap_onCustomObj = groupByWithMap(myCustomObj, ([k, v]) => { return v % 2 === 0 }, ([k, v]) => [k, v - 1])
      const expected_onCustomObj = new Map<any, Object>([
        [false, { a: 1 - 1, d: 3 - 1 }], [true, { b: 2 - 1, c: 2 - 1 }]
      ])

      const groupByWithMap_onMap = groupByWithMap(myMap, (v, k) => { return v % 2 === 0 }, ([k, v]) => [k, v - 1])
      const expected_onMap = new Map([
        [false, new Map([["a", 1 - 1], ["d", 3 - 1]])],
        [true, new Map([["b", 2 - 1], ["c", 2 - 1]])]
      ]);

      const groupByWithMap_onSet = groupByWithMap(mySet, (v) => { return v % 2 === 0 }, (v) => v - 1)
      const expected_onSet = new Map([
        [false, new Set([1 - 1, 3 - 1, 5 - 1])],
        [true, new Set([2 - 1, 4 - 1])]
      ]);

      const groupByWithMap_onArr = groupByWithMap(myArr, (v) => { return v % 2 === 0 }, (v) => v - 1)
      const expected_onArr = new Map([[false, [1 - 1, 3 - 1, 5 - 1]], [true, [2 - 1, 4 - 1]]]);
      //test
      expect(groupByWithMap_onObj).toStrictEqual(expected_onObj)
      expect(groupByWithMap_onCustomObj).toStrictEqual(expected_onCustomObj)
      expect(groupByWithMap_onMap).toStrictEqual(expected_onMap)
      expect(groupByWithMap_onSet).toStrictEqual(expected_onSet)
      expect(groupByWithMap_onArr).toStrictEqual(expected_onArr)
    })
    it("doesn't mutate the struct passed in (not counting the passed function behavior)", () => {
      //setup
      const myObj = { "a": 1, "b": 2, "c": 2, "d": 3 }
      class myClass {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const myCustomObj = new myClass(1, 2, 2, 3)
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 3)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply
      const groupByWithMap_onObj = groupByWithMap(myObj, ([k, v]) => { return v % 2 === 0 })
      const groupByWithMap_onCustomObj = groupByWithMap(myCustomObj, ([k, v]) => { return v % 2 === 0 })
      const groupByWithMap_onMap = groupByWithMap(myMap, (v, k) => { return v % 2 === 0 })
      const groupByWithMap_onSet = groupByWithMap(mySet, (v) => { return v % 2 === 0 })
      const groupByWithMap_onArr = groupByWithMap(myArr, (v) => { return v % 2 === 0 })
      //(redefine original struct (expected values))
      const originalObj = { "a": 1, "b": 2, "c": 2, "d": 3 }
      class myClassCopy {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const originalCustomObj = new myClass(1, 2, 2, 3)
      const notOriginalCustomObj = new myClassCopy(1, 2, 2, 3)
      const originalMap = new Map()
      originalMap.set("a", 1).set("b", 2).set("c", 2).set("d", 3)
      //test
      expect(myObj).toStrictEqual(originalObj)
      expect(myCustomObj).toStrictEqual(originalCustomObj)
      let originalArr = [1, 2, 3, 4, 5]
      const originalSet = new Set(originalArr)
      //* jest does not have a way of expecting a test to not pass (test on next line)
      // expect(myCustomObj).toStrictEqual(notOriginalCustomObj).toBe(false)
      expect(myMap).toStrictEqual(originalMap)
      expect(mySet).toStrictEqual(originalSet)
      expect(myArr).toStrictEqual(originalArr)

    })
    it("implementation: works with values in returned Map being falsy values", () => {
      //* not possible because the values of the returned Map starts with an array/Set/Map with 1
      //* (or 0 if we add the fn which change the elts grouped) element, which is truthy
      //setup
      const emptyArr = []
      const myArr1 = [0]
      //apply
      const groupBy_withEmptyArr = groupByWithMap(emptyArr, (v) => { return "key" })

      const groupBy_withMyArr1 = groupByWithMap(myArr1, (v) => { return "key" })
      const expected_withMyArr1 = new Map([["key", [0]]])
      //test
      expect(groupBy_withEmptyArr.size).toBe(0)
      expect(groupBy_withMyArr1).toStrictEqual(expected_withMyArr1)
    })
  })

  describe("groupByWithObject()", () => {
    it("returns an literal object", () => {
      const returnStruct = groupByWithObj([], () => { })
      expect(toType(returnStruct)).toBe("[object Object]")
    })

    it("group the number of instances where the function returns the same value", () => {
      //setup
      const myObj = { "a": 1, "b": 2, "c": 2, "d": 3 }
      class myClass {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const myCustomObj = new myClass(1, 2, 2, 3)
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 3)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply
      const groupByWithObj_onObj = groupByWithObj(myObj, ([k, v]) => { return v % 2 === 0 })
      const expected_onObj = { false: { a: 1, d: 3 }, true: { b: 2, c: 2 } }

      const groupByWithObj_onCustomObj = groupByWithObj(myCustomObj, ([k, v]) => { return v % 2 === 0 })
      const expected_onCustomObj = { false: { a: 1, d: 3 }, true: { b: 2, c: 2 } }

      const groupByWithObj_onMap = groupByWithObj(myMap, (v, k) => { return v % 2 === 0 })
      const expected_onMap = {
        false: new Map([["a", 1], ["d", 3]]),
        true: new Map([["b", 2], ["c", 2]])
      };

      const groupByWithObj_onSet = groupByWithObj(mySet, (v) => { return v % 2 === 0 })
      const expected_onSet = {
        false: new Set([1, 3, 5]),
        true: new Set([2, 4])
      }

      const groupByWithObj_onArr = groupByWithObj(myArr, (v) => { return v % 2 === 0 })
      const expected_onArr = {
        false: [1, 3, 5], true: [2, 4]
      }

      //test
      expect(groupByWithObj_onObj).toStrictEqual(expected_onObj)
      expect(groupByWithObj_onCustomObj).toStrictEqual(expected_onCustomObj)
      expect(groupByWithObj_onMap).toStrictEqual(expected_onMap)
      expect(groupByWithObj_onSet).toStrictEqual(expected_onSet)
      expect(groupByWithObj_onArr).toStrictEqual(expected_onArr)
    })

    it("optionnally applies a function to the values grouped", () => {
      //setup
      const myObj = { "a": 1, "b": 2, "c": 2, "d": 3 }
      class myClass {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const myCustomObj = new myClass(1, 2, 2, 3)
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 3)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply: on obj
      const groupByWithObj_onObj = groupByWithObj(myObj, ([k, v]) => { return v % 2 === 0 }, ([k, v]) => [k, v + 1])
      const expected_onObj = { false: { a: 1 + 1, d: 3 + 1 }, true: { b: 2 + 1, c: 2 + 1 } }

      //apply: on custom obj
      const groupByWithObj_onCustomObj = groupByWithObj(myCustomObj, ([k, v]) => { return v % 2 === 0 }, ([k, v]) => [k, v + 1])
      const expected_onCustomObj = { false: { a: 1 + 1, d: 3 + 1 }, true: { b: 2 + 1, c: 2 + 1 } }

      //apply: on Map 
      const groupByWithObj_onMap = groupByWithObj(myMap, (v, k) => { return v % 2 === 0 }, ([k, v]) => [k, v + 1])
      const expected_onMap = {
        false: new Map([["a", 1 + 1], ["d", 3 + 1]]),
        true: new Map([["b", 2 + 1], ["c", 2 + 1]])
      };

      //apply: on Set 
      const groupByWithObj_onSet = groupByWithObj(mySet, (v) => { return v % 2 === 0 }, (v) => v + 1)
      const expected_onSet = {
        false: new Set([1 + 1, 3 + 1, 5 + 1]),
        true: new Set([2 + 1, 4 + 1])
      }

      //apply: on array 
      const groupByWithObj_onArr = groupByWithObj(myArr, (v) => { return v % 2 === 0 }, (v) => v + 1)
      const expected_onArr = {
        false: [1 + 1, 3 + 1, 5 + 1], true: [2 + 1, 4 + 1]
      }

      //test
      expect(groupByWithObj_onObj).toStrictEqual(expected_onObj)
      expect(groupByWithObj_onCustomObj).toStrictEqual(expected_onCustomObj)
      expect(groupByWithObj_onMap).toStrictEqual(expected_onMap)
      expect(groupByWithObj_onSet).toStrictEqual(expected_onSet)
      expect(groupByWithObj_onArr).toStrictEqual(expected_onArr)
    })
    it("doesn't mutate the struct passed in (not counting the passed function behavior)", () => {
      //setup
      const myObj = { "a": 1, "b": 2, "c": 2, "d": 3 }
      class myClass {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const myCustomObj = new myClass(1, 2, 2, 3)
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 3)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply
      const groupByWithObj_onObj = groupByWithObj(myObj, ([k, v]) => { return v % 2 === 0 })
      const groupByWithObj_onCustomObj = groupByWithObj(myCustomObj, ([k, v]) => { return v % 2 === 0 })
      const groupByWithObj_onMap = groupByWithObj(myMap, (v, k) => { return v % 2 === 0 })
      const groupByWithObj_onSet = groupByWithObj(mySet, (v) => { return v % 2 === 0 })
      const groupByWithObj_onArr = groupByWithObj(myArr, (v) => { return v % 2 === 0 })
      //(redefine original struct (expected values))
      const originalObj = { "a": 1, "b": 2, "c": 2, "d": 3 }
      class myClassCopy {
        a: number; b: number; c: number; d: number;
        constructor(a, b, c, d) { this.a = a; this.b = b; this.c = c; this.d = d }
      }
      const originalCustomObj = new myClass(1, 2, 2, 3)
      const notOriginalCustomObj = new myClassCopy(1, 2, 2, 3)
      const originalMap = new Map()
      originalMap.set("a", 1).set("b", 2).set("c", 2).set("d", 3)
      //test
      expect(myObj).toStrictEqual(originalObj)
      expect(myCustomObj).toStrictEqual(originalCustomObj)
      let originalArr = [1, 2, 3, 4, 5]
      const originalSet = new Set(originalArr)
      //* jest does not have a way of expecting a test to not pass (test on next line)
      // expect(myCustomObj).toStrictEqual(notOriginalCustomObj).toBe(false)
      expect(myMap).toStrictEqual(originalMap)
      expect(mySet).toStrictEqual(originalSet)
      expect(myArr).toStrictEqual(originalArr)
    })
  })

  describe("extractKeysFrom()", () => {
    it("transform an array of object, each having a `key` key, to the corresponding object", () => {
      //setup
      const arr = [
        { key: "mark johansson", name: 'waffle', price: '80', quantity: '2' },
        { key: "mark johansson", name: 'blender', price: '200', quantity: '1' },
        { key: "mark johansson", name: 'knife', price: '10', quantity: '4' },
        { key: 'Nikita Smith', name: 'waffle', price: '90', quantity: '1' },
        { key: 'Nikita Smith', name: 'knife', price: '10', quantity: '2' },
        { key: 'Nikita Smith', name: 'pot', price: '20', quantity: '3' }
      ]
      //apply
      const result = extractKeysFrom(arr)
      const expected = {
        "mark johansson": [
          { name: 'waffle', price: '80', quantity: '2' },
          { name: 'blender', price: '200', quantity: '1' },
          { name: 'knife', price: '10', quantity: '4' }
        ],
        'Nikita Smith': [
          { name: 'waffle', price: '90', quantity: '1' },
          { name: 'knife', price: '10', quantity: '2' },
          { name: 'pot', price: '20', quantity: '3' }
        ]
      }
      //test

      expect(result).toStrictEqual(expected)
    })
    it("converts the `key` value to a string on the final object", () => {
      //setup
      const arr = [
        { key: { key: "mama" }, name: 'waffle', price: '80', quantity: '2' },
        { key: { key: "mama" }, name: 'blender', price: '200', quantity: '1' },
        { key: { key: "mama" }, name: 'knife', price: '10', quantity: '4' }
      ]
      //apply
      const result = extractKeysFrom(arr)
      const expected = {
        "[object Object]": [
          { name: 'waffle', price: '80', quantity: '2' },
          { name: 'blender', price: '200', quantity: '1' },
          { name: 'knife', price: '10', quantity: '4' }
        ],
      }
      //test
      expect(result).toStrictEqual(expected)
    })
    it("doesn't mutate the original array", () => {
      //setup
      const arr = [
        { key: "mark johansson", name: 'waffle', price: '80', quantity: '2' },
        { key: "mark johansson", name: 'blender', price: '200', quantity: '1' },
        { key: "mark johansson", name: 'knife', price: '10', quantity: '4' },
        { key: 'Nikita Smith', name: 'waffle', price: '90', quantity: '1' },
        { key: 'Nikita Smith', name: 'knife', price: '10', quantity: '2' },
        { key: 'Nikita Smith', name: 'pot', price: '20', quantity: '3' }
      ]
      //apply
      extractKeysFrom(arr)
      const copyOfOriginalArr = [
        { key: "mark johansson", name: 'waffle', price: '80', quantity: '2' },
        { key: "mark johansson", name: 'blender', price: '200', quantity: '1' },
        { key: "mark johansson", name: 'knife', price: '10', quantity: '4' },
        { key: 'Nikita Smith', name: 'waffle', price: '90', quantity: '1' },
        { key: 'Nikita Smith', name: 'knife', price: '10', quantity: '2' },
        { key: 'Nikita Smith', name: 'pot', price: '20', quantity: '3' }
      ]
      //test
      expect(arr).toStrictEqual(copyOfOriginalArr)
    })
  })
})
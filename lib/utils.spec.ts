import { beforeEach, describe, expect, it, test } from '@jest/globals';
import { countByWithMap, countByWithObj, cut, groupByWithMap, groupByWithObj, justOnce, toType } from './utils';

//NOTES: use toStrictEqual to compare object values, not toMatchObject
//toStrictEqual do not always check the types on the keys  of Map ( check groupByWithMap_onObj: not able to reproduce simply)? 

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
  beforeEach(() => {
    const myMap = new Map()
    myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 3)
    const myArr = [1, 2, 3, 4, 5]
    const mySet = new Set(myArr)
  });

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

    it("implementation: works with values in returned Map being falsy values", () => {
      //* not possible because the values of the returned Map starts with an array/Set/Map with 1 element, which is truthy
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

  })
})
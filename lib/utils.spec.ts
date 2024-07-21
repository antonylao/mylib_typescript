import { beforeEach, describe, expect, it, test } from '@jest/globals';
import { countBy, cut, groupBy, justOnce } from './utils';


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

  describe("countBy()", () => {
    it("counts the number of instances where the function returns the same value", () => {
      //setup
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 3)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply
      const countBy_withMap = countBy(myMap, (v, k) => { return v % 2 === 0 })
      const expectedWithMap = new Map([[false, 2], [true, 2]]);

      const countBy_withSet = countBy(mySet, (v) => { return v % 2 === 0 })
      const expectedWithSet = new Map([[false, 3], [true, 2]]);

      const countBy_withArr = countBy(myArr, (v) => { return v % 2 === 0 })
      const expectedWithArr = new Map([[false, 3], [true, 2]]);
      //test
      expect(Object.fromEntries(countBy_withMap)).toMatchObject(Object.fromEntries(expectedWithMap))
      expect(Object.fromEntries(countBy_withSet)).toMatchObject(Object.fromEntries(expectedWithSet))
      expect(Object.fromEntries(countBy_withArr)).toMatchObject(Object.fromEntries(expectedWithArr))
    })

    it("implementation: works with values in returned Map being falsy values", () => {
      //* not possible because the values of the returned map start with 1, then incremented => values are always truthy
      //setup
      const myMap = new Map()
      myMap.set("a", "val")
      //apply
      const countBy_result = countBy(myMap, (v, k) => { return "key" })
      const expected = new Map([["key", 1]])
      //test
      expect(Object.fromEntries(countBy_result)).toMatchObject(Object.fromEntries(expected))
    })
  })

  describe("groupBy()", () => {
    it("group the number of instances where the function returns the same value", () => {
      //setup
      const myMap = new Map()
      myMap.set("a", 1).set("b", 2).set("c", 2).set("d", 3)
      let myArr = [1, 2, 3, 4, 5]
      const mySet = new Set(myArr)
      //apply
      const groupBy_withMap = groupBy(myMap, (v, k) => { return v % 2 === 0 })
      const expectedWithMap = new Map([
        [false, new Map([["a", 1], ["d", 3]])],
        [true, new Map([["b", 2], ["c", 2]])]
      ]);

      const groupBy_withSet = groupBy(mySet, (v) => { return v % 2 === 0 })
      const expectedWithSet = new Map([
        [false, new Set([1, 3, 5])],
        [true, new Set([2, 4])]
      ]);

      const groupBy_withArr = groupBy(myArr, (v) => { return v % 2 === 0 })
      const expectedWithArr = new Map([[false, [1, 3, 5]], [true, [2, 4]]]);
      //test
      expect(Object.fromEntries(groupBy_withMap)).toMatchObject(Object.fromEntries(expectedWithMap))
      expect(Object.fromEntries(groupBy_withSet)).toMatchObject(Object.fromEntries(expectedWithSet))
      expect(Object.fromEntries(groupBy_withArr)).toMatchObject(Object.fromEntries(expectedWithArr))
    })

    it("implementation: works with values in returned Map being falsy values", () => {
      //* not possible because the values of the returned Map starts with an array/Set/Map with 1 element, which is truthy
      //setup
      const emptyArr = []
      const myArr1 = [0]
      //apply
      const groupBy_withEmptyArr = groupBy(emptyArr, (v) => { return "key" })

      const groupBy_withMyArr1 = groupBy(myArr1, (v) => { return "key" })
      const expected_withMyArr1 = new Map([["key", [0]]])
      // const expected = new Map([["key", new Map([[0, 0]])]])
      //test
      //NB: `toMatchObject` method always return true when test against an expected empty object!`
      //    So in the first test we use the length of the object to verify that it is empty
      expect(groupBy_withEmptyArr.size).toBe(0)
      expect(Object.fromEntries(groupBy_withMyArr1)).toMatchObject(Object.fromEntries(expected_withMyArr1))
    })
  })
})
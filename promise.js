var soon = (function() {
	
  var fq = []; // function queue;

  function callQueue()
  {
    while(fq.length) // this approach allows new yields to pile on during the execution of these
    {
      var fe = fq[0];
      fe.f.apply(fe.m,fe.a) // call our fn with the args and preserve context
      fq.shift(); // remove element just processed... do this after processing so we don't go 0 and trigger soon again
    }
  }

  // run the callQueue function asyncrhonously, as fast as possible
  var cqYield = (function() {

      // This is the fastest way browsers have to yield processing
      if(typeof MutationObserver !== "undefined")
      {
        // first, create a div not attached to DOM to "observe"
        var dd = document.createElement("div");
        var mo = new MutationObserver(callQueue);
        mo.observe(dd, { attributes: true });

        return function() { dd.setAttribute("a",0); } // trigger callback to
      }

      // if No MutationObserver - this is the next best thing - handles Node and MSIE
      if(typeof setImmediate !== "undefined")
        return function() { setImmediate(callQueue) }

      // final fallback - shouldn't be used for much except very old browsers
      return function() { setTimeout(callQueue,0) }
    })();

  // this is the function that will be assigned to soon
  // it takes the function to call and examines all arguments
  return function(fn) {

      // push the function and any remaining arguments along with context
      fq.push({f:fn,a:[].slice.apply(arguments).splice(1),m:this});

      if(fq.length == 1) // upon adding our first entry, kick off the callback
        cqYield();
    };

})();

class MyPromise {
  constructor (executor) {
    this.executor = executor;
    this.data = '';
    this.status = 'pending';
    this.onResolveCallback = [];
    this.onRejectCallback = [];
    try {
      executor(this.resolve, this.reject);
    } catch(e) {
      console.error(e)
    }
  }
  //执行回调函数
  resolve = (data) => {
    soon(() => {
      if (this.status == 'pending') {
        this.status = 'fulfilled';
        this.data = data;
        while (this.onResolveCallback.length) {
          this.onResolveCallback.shift()(this.data);
        }
        this.onRejectCallback = [];
      }
    })
  }
  //执行回调函数
  reject = (reason) => {
    soon(() => {
      if (this.status == 'pending') {
        this.status = 'rejected';
        this.data = reason;
        while (this.onRejectCallback.length) {
          this.onRejectCallback.shift()(this.data);
        }
        this.onResolveCallback = [];
      }
    })
  }

  resolvePromise = (promise2, x, resolve, reject) => {
    let then,
        thenCalledOrThrowed = false;
    if (x === promise2) {
      return reject(new Error('Chaining cycle detected for promise!'));
    }
    //若x是本实现下的一个promise
    if (x instanceof MyPromise) {
      if (x.status == 'pending') {
        x.then((val) => {
          //再次检查x fulfilled时返回的值
          resolvePromise(promise2, val, resolve, reject);
        }, reject);
      } else {
        x.then(resolve, reject);
      }
      return;
    }
    // 若x是thenable
    if ((x != null) && (typeof x == 'object' || typeof x == 'function')) {
      try {
        then = x.then;
        // 如果then是一个getter，多次调用会有副作用。
        if (typeof then === 'function') {
          then.call(x, y => {
            if (thenCalledOrThrowed) return;
            thenCalledOrThrowed = true;
            return this.resolvePromise(promise2, y, resolve, reject);
          }, r => {
            if (thenCalledOrThrowed) return;
            thenCalledOrThrowed = true;
            return reject(r);
          })
        } else {
          resolve(x);
        }
      } catch(e) {
        return reject(e);
      }
    } else {
      resolve(x);
    }
  }

  //execute function or add to the queue;
  then = (onResolved, onRejected) => {
    let that = this;
    
    let temp = function (reason) {
      console.error(reason);
      return MyPromise.stop();
    };
    onResolved = typeof onResolved === 'function' ? onResolved : function (val) {return val};
    onRejected = typeof onRejected === 'function' ? onRejected : temp;
    // if (this.status === 'fulfilled') {
    //   return new MyPromise ((resolve, reject) => {
    //     sonn(() => {
    //       console.log('f')
    //       try {
    //         let x = onResolved(this.data);
    //         this.resolvePromise(that, x, resolve, reject);
    //       } catch(e) {
    //         console.error(e);
    //         // reject(e);
    //       }
    //     })
    //   })
    // }
    // if (this.status === 'rejected') {
    //   return new MyPromise ((resolve, reject) => {
    //     soon(() => {
    //         try {
    //         let x = onRejected(this.data);
    //         this.resolvePromise(that, x, resolve, reject);
    //       } catch(e) {
    //         console.error(e);
    //         // reject(e);
    //       }
    //     })
    //   })
    // }
    // if (this.status === 'pending') {
      return new MyPromise((resolve, reject) => {
        this.onResolveCallback.push(() => {
          try {
            let x = onResolved(this.data);
            this.resolvePromise(that, x, resolve, reject);
          } catch(e) {
            console.error(e);
            reject(e);
          }
        });
        this.onRejectCallback.push(() => {
          try {
            let x = onRejected(this.data);
            this.resolvePromise(that, x, resolve, reject);
          } catch(e) {
            console.error(e);
            reject(e);
          }
        });
      })
    // }
  }

  catch = (onRejected) => {
    return this.then(null, onRejected);
  }

  static stop = () => {
    return new MyPromise(()=>{})
  }

  all = (arr) => {
    return new MyPromise((resolve, reject) => {
      let resolveList = [];
      arr.forEach((e) => {
        e.then((val) => {
          resolveList.push(val);
          if (resolveList.length == arr.length) {
            resolve(resolveList);
          }
        }, reason => {
          reject(reason);
        })
      })
    })
  }

  race = (arr) => {
    return new MyPromise((resolve, reject) => {
      arr.forEach(e => {
        e.then(val => resolve(val), reason => reject(reason));
      })
    })
  }

  static resolve = (val) => {
    return new MyPromise((resolve, reject) => {
      resolve(val);
    });
  }
  
  static reject = (reason) => {
    return new MyPromise((resolve, reject) => {
      reject(reason);
    });
  }

}
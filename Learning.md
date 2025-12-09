# Binding Issue: 
```javascript
class A {
  x = 10;

  print() {
    console.log(this.x);
  }
}

const a = new A();
const fn = a.print;

fn();  // ❌ ERROR: this is undefined

const fn2 = a.print.bind(a);
fn2(); // ✔ prints 10

```
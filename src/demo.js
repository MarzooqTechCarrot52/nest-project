import { firstValueFrom,lastValueFrom, Observable } from 'rxjs';

const obs$ = new Observable((subscriber) => {
  subscriber.next(1);
  subscriber.next(2);
  subscriber.next(3);
  subscriber.next(4);
  subscriber.complete();
});
const firstvalue = await firstValueFrom(obs$);
console.log(firstvalue); 
const lastvalue = await lastValueFrom(obs$);
console.log(lastvalue);
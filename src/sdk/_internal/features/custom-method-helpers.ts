
import { WebAppKernel } from '../core/kernel';

export function invokeGetRequestedContact(
  kernel: WebAppKernel,
  callback: (result: string) => void,
  timeout: number
): void {
  let reqTo: ReturnType<typeof setTimeout>;
  let fallbackTo: ReturnType<typeof setTimeout>;
  let reqDelay = 0;

  const reqInvoke = (): void => {
    kernel.invokeCustomMethod('getRequestedContact', {}, (_err: any, res: any) => {
      if (typeof res === 'string' && res.substr(0, 1) == '"' && res.substr(-1) == '"') {

        res = JSON.parse(res);
      }
      if (res && res.length) {
        clearTimeout(fallbackTo);
        callback(res);
      } else {
        reqDelay += 50;
        reqTo = setTimeout(reqInvoke, reqDelay);
      }
    });
  };

  const fallbackInvoke = (): void => {
    clearTimeout(reqTo);
    callback('');
  };

  fallbackTo = setTimeout(fallbackInvoke, timeout);
  reqInvoke();
}

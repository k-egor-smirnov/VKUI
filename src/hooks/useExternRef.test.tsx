import { render } from '@testing-library/react';
import { noop } from '../lib/utils';
import { createRef, useLayoutEffect, useRef, FC, RefObject } from 'react';
import { HasRef } from '../types';
import { useExternRef } from './useExternRef';

const RefForwarder = (props: HasRef<HTMLDivElement>) => <div ref={useExternRef(props.getRef)} />;
describe(useExternRef, () => {
  describe('manages inner ref', () => {
    it('ensures ref exists', () => {
      const OuterRef: FC = () => {
        expect(useExternRef()).toBeTruthy();
        return null;
      };
      render(<OuterRef />);
    });
    it('keeps inner ref.current up-to-date', () => {
      let firstRef: RefObject<any>;
      let counter = 0;
      const RefForwarder: FC<HasRef<any>> = (props) => {
        const ref = useExternRef(props.getRef);
        firstRef = firstRef || ref;
        counter += 1;
        ref.current = counter;
        return null;
      };
      render(<RefForwarder getRef={() => null} />)
        .rerender(<RefForwarder getRef={() => null} />);
      expect(firstRef.current).toBe(counter);
    });
  });
  describe('sets outer ref to null', () => {
    it('on wrapper unmount', () => {
      const ref = createRef<HTMLDivElement>();
      render(<RefForwarder getRef={ref} />).unmount();
      expect(ref.current).toBeNull();
    });
    it('on inner node unmount', () => {
      const ref = createRef();
      const RefForwarder = (props: HasRef<any> & { hide?: boolean }) => {
        const ref = useExternRef(props.getRef);
        return props.hide ? null : <div ref={ref} />;
      };
      render(<RefForwarder getRef={ref} />).rerender(<RefForwarder getRef={ref} hide />);
      expect(ref.current).toBeNull();
    });
  });
  describe('calls outer ref', () => {
    it('before useLayoutEffect', () => {
      const RefUser = () => {
        const ref = useRef();
        useLayoutEffect(() => {
          expect(ref.current).toBeInTheDocument();
        }, []);
        return <RefForwarder getRef={ref} />;
      };
      render(<RefUser />);
    });
    it('when node changes', () => {
      const ref = createRef();
      const RefForwarder = (props: HasRef<any> & { remountKey?: any }) => (
        <div key={props.remountKey} ref={useExternRef(props.getRef)} />);
      render(<RefForwarder getRef={ref} />).rerender(<RefForwarder getRef={ref} remountKey="123" />);
      expect(ref.current).toBeInTheDocument();
    });
    it('when ref identity changes', () => {
      const secondRef = jest.fn();
      render(<RefForwarder getRef={noop} />).rerender(<RefForwarder getRef={secondRef} />);
      expect(secondRef).toHaveBeenCalled();
    });
    it('once per identity', () => {
      const ref = jest.fn();
      render(<RefForwarder getRef={ref} />).rerender(<RefForwarder getRef={ref} />);
      expect(ref).toHaveBeenCalledTimes(1);
    });
  });
});

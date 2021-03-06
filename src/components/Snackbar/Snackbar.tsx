import React, {
  FC,
  HTMLAttributes,
  MouseEventHandler,
  useEffect,
  useRef,
  useState,
} from 'react';
import Touch, { TouchEvent } from '../Touch/Touch';
import { classNames } from '../../lib/classNames';
import { HasPlatform } from '../../types';
import { getClassName } from '../../helpers/getClassName';
import { canUseDOM } from '../../lib/dom';
import { ANDROID, VKCOM } from '../../lib/platform';
import { rubber } from '../../lib/touch';
import { withAdaptivity, AdaptivityProps, ViewWidth } from '../../hoc/withAdaptivity';
import Text from '../Typography/Text/Text';
import Button from '../Button/Button';
import { AppRootPortal } from '../AppRoot/AppRootPortal';
import { useWaitTransitionFinish } from '../../hooks/useWaitTransitionFinish';
import { usePlatform } from '../../hooks/usePlatform';

export interface SnackbarProps extends HTMLAttributes<HTMLElement>, HasPlatform, AdaptivityProps {
  /**
   * Название кнопки действия в уведомлении
   */
  action?: string | React.ComponentType;

  /**
   * Будет вызвано при клике на кнопку действия
   */
  onActionClick?: (e: React.MouseEvent) => void;

  /**
   * Цветная иконка 24x24 пикселя
   */
  before?: React.ReactNode;
  /**
   * Контент в правой части, может быть `<Avatar size={32} />`
   */
  after?: React.ReactNode;
  /**
   * Варианты расположения кнопки
   */
  layout?: 'vertical' | 'horizontal';
  /**
   * Время в миллисекундах, через которое плашка скроется
   */
  duration?: number;
  /**
   * Обработчик закрытия уведомления
   */
  onClose: () => void;
}

const SnackbarComponent: FC<SnackbarProps> = (props: SnackbarProps) => {
  const {
    children,
    layout,
    action,
    before,
    after,
    viewWidth,
    duration,
    onActionClick,
    onClose,
    ...restProps
  } = props;

  const platform = usePlatform();

  const { waitTransitionFinish } = useWaitTransitionFinish();

  const [closing, setClosing] = useState(false);
  const [touched, setTouched] = useState(false);

  const shiftXPercentRef = useRef<number>(0);
  const shiftXCurrentRef = useRef<number>(0);
  const touchStartTimeRef = useRef<Date | null>(null);

  const bodyElRef = useRef<HTMLDivElement | null>(null);
  const innerElRef = useRef<HTMLDivElement | null>(null);

  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const isDesktop = viewWidth >= ViewWidth.SMALL_TABLET;
  const transitionFinishDurationFallback = platform === ANDROID || platform === VKCOM ? 400 : 320;

  const close = () => {
    setClosing(true);
    waitTransitionFinish(innerElRef.current, () => {
      onClose();
    }, transitionFinishDurationFallback);
  };

  const handleActionClick: MouseEventHandler<HTMLElement> = (e) => {
    close();

    if (action && typeof onActionClick === 'function') {
      onActionClick(e);
    }
  };

  const setCloseTimeout = () => {
    if (canUseDOM) {
      closeTimeoutRef.current = setTimeout(() => {
        close();
      }, duration);
    }
  };

  const clearCloseTimeout = () => {
    clearTimeout(closeTimeoutRef.current);
  };

  const setBodyTransform = (percent: number) => {
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(() => {
      if (bodyElRef.current) {
        bodyElRef.current.style.transform = `translate3d(${percent}%, 0, 0)`;
      }
    });
  };

  const onTouchStart = () => {
    clearCloseTimeout();
  };

  const onTouchMoveX = (event: TouchEvent) => {
    const { shiftX, startT, originalEvent } = event;
    originalEvent.preventDefault();

    if (!touched) {
      setTouched(true);
    }

    shiftXPercentRef.current = shiftX / bodyElRef.current.offsetWidth * 100;
    shiftXCurrentRef.current = rubber(shiftXPercentRef.current, 72, 1.2, platform === ANDROID || platform === VKCOM);
    touchStartTimeRef.current = startT;

    setBodyTransform(shiftXCurrentRef.current);
  };

  const onTouchEnd = () => {
    let callback: VoidFunction | undefined;

    if (touched) {
      let shiftXCurrent = shiftXCurrentRef.current;
      const expectTranslateY = shiftXCurrent / (Date.now() - touchStartTimeRef.current.getTime()) * 240 * 0.6;
      shiftXCurrent = shiftXCurrent + expectTranslateY;

      if (isDesktop && shiftXCurrent <= -50) {
        clearCloseTimeout();
        waitTransitionFinish(bodyElRef.current, () => {
          onClose();
        }, transitionFinishDurationFallback);
        setBodyTransform(-120);
      } else if (!isDesktop && shiftXCurrent >= 50) {
        clearCloseTimeout();
        waitTransitionFinish(bodyElRef.current, () => {
          onClose();
        }, transitionFinishDurationFallback);
        setBodyTransform(120);
      } else {
        callback = () => {
          setCloseTimeout();
          setBodyTransform(0);
        };
      }
    } else {
      setCloseTimeout();
    }

    setTouched(false);
    callback && requestAnimationFrame(callback);
  };

  useEffect(() => {
    setCloseTimeout();

    return () => {
      clearCloseTimeout();
    };
  }, []);

  const resolvedLayout = after || isDesktop ? 'vertical' : layout;

  return (
    <AppRootPortal>
      <div
        {...restProps}
        vkuiClass={classNames(getClassName('Snackbar', platform), `Snackbar--l-${resolvedLayout}`, {
          'Snackbar--closing': closing,
          'Snackbar--touched': touched,
          'Snackbar--desktop': isDesktop,
        })}
      >
        <Touch
          vkuiClass="Snackbar__in"
          getRootRef={innerElRef}
          onStart={onTouchStart}
          onMoveX={onTouchMoveX}
          onEnd={onTouchEnd}
        >
          <div vkuiClass="Snackbar__body" ref={bodyElRef}>
            {before &&
            <div vkuiClass="Snackbar__before">
              {before}
            </div>}

            <div vkuiClass="Snackbar__content">
              <Text weight="regular" vkuiClass="Snackbar__content-text">{children}</Text>

              {action &&
              <Button align="left" hasHover={false} mode="tertiary" size="s" vkuiClass="Snackbar__action" onClick={handleActionClick}>
                {action}
              </Button>}
            </div>

            {after &&
            <div vkuiClass="Snackbar__after">
              {after}
            </div>}
          </div>
        </Touch>
      </div>
    </AppRootPortal>
  );
};

SnackbarComponent.displayName = 'Snackbar';

SnackbarComponent.defaultProps = {
  duration: 4000,
  layout: 'horizontal',
};

export const Snackbar = withAdaptivity(SnackbarComponent, {
  viewWidth: true,
});

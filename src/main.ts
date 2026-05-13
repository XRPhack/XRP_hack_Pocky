import './styles.css';
import { getAppRoot, mountAppPlaceholder, resolveRouteKey } from './apps/app-placeholder';
import { mountComponentDemo } from './apps/dev-components';

const root = getAppRoot();
const pathname = window.location.pathname;

if (pathname === '/dev/components' || pathname.startsWith('/dev/components/')) {
  mountComponentDemo(root);
} else if (pathname.startsWith('/verify/')) {
  void import('./apps/verify/main');
} else {
  mountAppPlaceholder(root, resolveRouteKey());
}

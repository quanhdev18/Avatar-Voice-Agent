import { useEffect } from 'react';
import { Route, Router, Switch } from 'wouter';

import { StoreProvider, useStore } from '@/lib/store';
import { net } from '@/net/client';
import { Toasts } from '@/components/Layout';
import Home from '@/pages/Home';
import Lobby from '@/pages/Lobby';
import Room from '@/pages/Room';
import Customize from '@/pages/Customize';
import Play from '@/pages/Play';
import Results from '@/pages/Results';
import Kit from '@/pages/Kit';
import NotFound from '@/pages/NotFound';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <StoreProvider>
      <NetBridge />
      <Toasts />
      <Router base={base}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/lobby" component={Lobby} />
          <Route path="/room/:id" component={Room} />
          <Route path="/room/:id/play">{() => <Play online />}</Route>
          <Route path="/customize" component={Customize} />
          <Route path="/play">{() => <Play />}</Route>
          <Route path="/results" component={Results} />
          <Route path="/kit" component={Kit} />
          <Route component={NotFound} />
        </Switch>
      </Router>
    </StoreProvider>
  );
}

/** Keeps the WebSocket connected and the server in sync with the local profile. */
function NetBridge() {
  const { profile } = useStore();
  const { name, color, accessory, weapon } = profile;
  useEffect(() => {
    net.connect({ name, color, accessory, weapon });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    net.updateProfile({ name, color, accessory, weapon });
  }, [name, color, accessory, weapon]);
  return null;
}

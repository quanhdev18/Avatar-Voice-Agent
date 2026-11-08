import { Route, Router, Switch } from 'wouter';

import { StoreProvider } from '@/lib/store';
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
      <Router base={base}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/lobby" component={Lobby} />
          <Route path="/room/:id" component={Room} />
          <Route path="/customize" component={Customize} />
          <Route path="/play" component={Play} />
          <Route path="/results" component={Results} />
          <Route path="/kit" component={Kit} />
          <Route component={NotFound} />
        </Switch>
      </Router>
    </StoreProvider>
  );
}

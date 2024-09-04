import React from 'react';
import Navbar from './components/Navbar';
import './App.css';
import Home from './components/pages/Home';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import About from './components/pages/About';
import Culinary from './components/pages/Culinary';
import Documents from './components/pages/Documents';
import Philosophy from './components/pages/Philosophy';
import Contact from './components/pages/Contact';


function App() {
  return (
    <>
      <Router>
        <Navbar />
        <Switch>
          <Route path='/' exact component={Home} />
          <Route path='/about' component={About} />
          <Route path='/culinary' component={Culinary} />
          <Route path='/documents' component={Documents} />
          <Route path='/philosophy' component={Philosophy} />
          <Route path='/contact' component={Contact} />
        </Switch>
      </Router>
    </>
  );
}

export default App;

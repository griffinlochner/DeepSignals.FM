import { useState } from "react";
import SignalRunnerScene from "./SignalRunnerScene";
import "./signalRunner.css";

function SignalRunnerPage() {
  const [flightSpeed, setFlightSpeed] = useState(42);

  return (
    <main className="signal-runner">
      <div className="signal-runner__canopy" aria-label="Spaceflight windshield">
        <div className="signal-runner__windshield">
          <SignalRunnerScene flightSpeed={flightSpeed} />
          <div className="signal-runner__glass" aria-hidden="true" />
        </div>
      </div>

      <div className="signal-runner__cockpit" aria-hidden="true">
        <div className="signal-runner__upper-frame">
          <div className="signal-runner__status-lights signal-runner__status-lights--upper">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <span>CANOPY SEAL // NOMINAL</span>
        </div>
      </div>

      <div className="signal-runner__lower-console">
        <div className="signal-runner__console-bank signal-runner__console-bank--green" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="signal-runner__console-display" aria-hidden="true">
          <span>DEEPSIGNALS.FM</span>
          <strong>SIGNAL RUNNER</strong>
          <small>FLIGHT SYSTEM // EXPERIMENTAL</small>
        </div>
        <aside className="signal-runner__controls" aria-label="Signal Runner controls">
          <div className="signal-runner__control-heading">
            <label htmlFor="signal-runner-speed">FLIGHT SPEED</label>
            <output htmlFor="signal-runner-speed">{Math.round(flightSpeed)}%</output>
          </div>
          <input
            id="signal-runner-speed"
            type="range"
            min="0"
            max="100"
            step="1"
            value={flightSpeed}
            onChange={(event) => setFlightSpeed(Number(event.target.value))}
          />
          <div className="signal-runner__scale" aria-hidden="true">
            <span>DRIFT</span>
            <span>CRUISE</span>
            <span>HYPER</span>
          </div>
        </aside>
        <div className="signal-runner__drive-status" aria-hidden="true">
          <span>MANUAL DRIVE</span>
          <strong>{Math.round(flightSpeed).toString().padStart(3, "0")}</strong>
        </div>
        <div className="signal-runner__console-bank signal-runner__console-bank--salmon" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </main>
  );
}

export default SignalRunnerPage;
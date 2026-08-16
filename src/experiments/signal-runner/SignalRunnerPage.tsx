import { useState } from "react";
import SignalRunnerExperience from "./SignalRunnerExperience";

function SignalRunnerPage() {
  const [flightSpeed, setFlightSpeed] = useState(42);

  return (
    <main>
      <SignalRunnerExperience
        controlMode="manual"
        manualFlightSpeed={flightSpeed}
        onManualFlightSpeedChange={setFlightSpeed}
        isPlaying
        volume={1}
        signalId="signal-runner-standalone"
        motionEnabled
        chromaEnabled
      />
    </main>
  );
}

export default SignalRunnerPage;
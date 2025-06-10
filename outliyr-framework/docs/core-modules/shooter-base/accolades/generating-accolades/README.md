# Generating Accolades

While defining accolades in data tables provides the "what" (what text, icon, sound to display), the crucial step of determining _when_ an accolade should be awarded happens on the server. Raw game events, like a single elimination or instance of damage, don't automatically correspond to accolades like "Double Kill" or "Assist." These require interpretation, state tracking, and logic – the job of **Gameplay Message Processors**.

### Introduction: From Events to Accolades

The game generates numerous events represented as **Gameplay Messages** (e.g., `Lyra.Elimination.Message`, `Lyra.Damage.Message`). However, many accolades depend on patterns, timing, or sequences of these events:

* A "Double Kill" requires two eliminations by the same player within a short time window.
* An "Assist" requires dealing damage to a player who is then eliminated by someone else.
* A "Killing Spree" requires multiple eliminations without the instigator being eliminated themselves.

Gameplay Message Processors are server-authoritative components designed specifically to listen for these raw event messages, maintain relevant state (like recent elimination times or damage dealt), apply logic, and then broadcast _new_ messages when the conditions for a specific accolade are met.

### `UGameplayMessageProcessor`: The Base Class

The foundation for all server-side accolade detection logic is the `UGameplayMessageProcessor` base class. It provides a standardized framework for creating these event listeners.

**Key Aspects:**

* **Actor Component:** Designed to be added as a component to an Actor. In the Lyra/Shooter Base context, these are typically added to the **GameState** Actor, ensuring they exist as singletons on the server.
* **Server-Authoritative:** These processors run exclusively on the server (or host) to make authoritative decisions about who earned which accolades.
* **Lifecycle:**
  * `BeginPlay` calls `StartListening`.
  * `StartListening` (override in child classes): This is where you use `UGameplayMessageSubsystem::RegisterListener` to subscribe to the specific gameplay messages your processor cares about (e.g., `Lyra.Elimination.Message`). Use `AddListenerHandle` to ensure the listener is automatically cleaned up.
  * `EndPlay` automatically unregisters all listeners added via `AddListenerHandle`, preventing dangling references or memory leaks.
* **`GetServerTime()`:** Provides access to the synchronized server world time, essential for implementing time-sensitive logic like elimination chains.

### Built-in Processors (Overview)

Shooter Base provides several pre-built processors inheriting from `UGameplayMessageProcessor` to handle common shooter accolades. These serve as excellent examples and cover many standard use cases:

* **`UEliminationAssistProcessor`:** Listens for damage and elimination messages to track which players contributed damage to an eliminated target, broadcasting an `Lyra.Assist.Message` for qualifying players.
* **`UEliminationChainProcessor`:** Tracks the timestamps of eliminations per player. If multiple eliminations occur within the configured `ChainTimeLimit`, it broadcasts specific accolade messages (e.g., `Accolade.DoubleKill`, `Accolade.TripleKill`) based on the chain length defined in `EliminationChainTags`.
* **`UEliminationStreakProcessor`:** Counts consecutive eliminations for each player, resetting the count when that player is eliminated. It broadcasts specific accolade messages (e.g., `Accolade.KillingSpree`, `Accolade.Unstoppable`) based on the streak length defined in `EliminationStreakTags`.

These processors demonstrate how to listen to messages, manage internal state (`TMap`s tracking player data), use server time, and trigger new events.

### Triggering Accolades: Broadcasting the Result

The final step for a processor, once it determines an accolade condition is met, is to notify the rest of the system. It does this by broadcasting a **new** Gameplay Message, typically a `FLyraVerbMessage`.

* **Message Content:** The processor constructs a `FLyraVerbMessage`.
* **The `Verb` Tag:** Crucially, the `Verb` field of this message is set to the specific Gameplay Tag corresponding to the accolade being awarded (e.g., `Accolade.DoubleKill`, `Accolade.Assist`). This tag is the key that the `UAccoladeRelay` (discussed next) and potentially other systems will listen for.
* **Payload:** The message also includes relevant context like the `Instigator` (the player who earned the accolade) and potentially `InstigatorTags`, `Target`, `Magnitude` (e.g., the streak count).
* **Broadcasting:** The processor uses `UGameplayMessageSubsystem::BroadcastMessage(AccoladeMessage.Verb, AccoladeMessage)` to send this message out.

```cpp
// Example snippet from UEliminationChainProcessor
if (FGameplayTag* pTag = EliminationChainTags.Find(History.ChainCounter))
{
    FLyraVerbMessage EliminationChainMessage;
    EliminationChainMessage.Verb = *pTag; // e.g., Accolade.DoubleKill
    EliminationChainMessage.Instigator = InstigatorPS;
    EliminationChainMessage.InstigatorTags = Payload.InstigatorTags;
    EliminationChainMessage.ContextTags = Payload.ContextTags;
    EliminationChainMessage.Magnitude = History.ChainCounter;

    UGameplayMessageSubsystem& MessageSubsystem = UGameplayMessageSubsystem::Get(this);
    MessageSubsystem.BroadcastMessage(EliminationChainMessage.Verb, EliminationChainMessage); // Notify system
}
```

These server-side processors act as the intelligent core of the accolade system, translating raw gameplay into meaningful, recognized achievements ready to be relayed to the player. The next section details how the `UAccoladeRelay` picks up these specific accolade messages and prepares them for client-side display.

***

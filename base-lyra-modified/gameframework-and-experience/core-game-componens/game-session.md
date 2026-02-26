# Game Session

The `ALyraGameSession` class, inheriting from the base engine `AGameSession`, traditionally handles logic related to managing the online or network session for the game, including player login validation, match state notifications, and interactions with the Online Subsystem.

However, in modern Unreal Engine development, particularly with the introduction of systems like the **Common Session Subsystem (`UCommonSessionSubsystem`)**, the role of the custom `AGameSession` subclass is often significantly reduced.

### Role in Lyra/Modular Framework

In Lyra and similar modular frameworks utilizing the Common Session Subsystem:

* **Reduced Responsibility:** Much of the heavy lifting for creating, finding, joining, and managing sessions is handled by `UCommonSessionSubsystem`. This subsystem is typically configured and driven by data, often originating from `ULyraUserFacingExperienceDefinition` assets (which generate `UCommonSession_HostSessionRequest` objects).
* **Focus on Overrides:** The primary purpose of `ALyraGameSession` becomes overriding specific base `AGameSession` virtual functions if custom behavior is needed beyond what `UCommonSessionSubsystem` provides, or if specific interactions with older Online Subsystem interfaces are required.
* **Legacy Hooks:** It still serves as a potential hook point for older systems or specific Online Subsystem implementations that might expect interactions directly via `AGameSession`.

### Key Overrides in `ALyraGameSession`

The provided code shows minimal overrides, indicating reliance on other systems:

* **`ProcessAutoLogin()`:**
  * **Override:** Returns `true` but notes that the actual logic for dedicated server auto-login is handled elsewhere (specifically in `ALyraGameMode::TryDedicatedServerLogin`).
  * **Purpose:** Disables the default base class auto-login behavior, deferring it to the Game Mode's more context-aware logic.
* **`HandleMatchHasStarted()` / `HandleMatchHasEnded()`:**
  * **Override:** Calls `Super::HandleMatchHasStarted()` / `Super::HandleMatchHasEnded()`.
  * **Purpose:** Provides standard hooks for reacting to the beginning and end of a match state, as potentially signaled by the engine or Online Subsystem. You would add custom logic here if needed (e.g., reporting scores, cleaning up session-specific data not handled elsewhere). Lyra's default implementation adds no extra logic here, suggesting these states might be managed by Experience/Game Mode logic instead.

### Interaction with Other Systems

* **`UCommonSessionSubsystem`:** This is the primary system `ALyraGameSession` implicitly relies on (by _not_ overriding many functions). The subsystem handles most session creation, joining, and management tasks based on requests often generated from `ULyraUserFacingExperienceDefinition`.
* **`ALyraGameMode`:** Handles aspects like dedicated server login (`TryDedicatedServerLogin`) which might traditionally have been placed in `AGameSession`.
* **Online Subsystem:** `AGameSession` (and `UCommonSessionSubsystem`) acts as an interface layer to the specific platform's Online Subsystem (OSS) implementation (e.g., OSS EOS, OSS Steam, OSS Null).

### When to Customize `ALyraGameSession`

You would typically only need to add significant custom logic to `ALyraGameSession` if:

* You need fine-grained control over player login approval/rejection beyond simple checks (`ApproveLogin`, `NotifyLogin`).
* You are integrating with an Online Subsystem that requires specific `AGameSession` interactions not covered by `UCommonSessionSubsystem`.
* You need very specific logic tied precisely to the `HandleMatchHasStarted` or `HandleMatchHasEnded` events that isn't better placed within the Experience lifecycle or Game Mode/State components.

For most common session management tasks in this framework, interacting with `UCommonSessionSubsystem` and configuring `ULyraUserFacingExperienceDefinition` is the preferred approach.

***

In summary, while `ALyraGameSession` exists as part of the core Unreal framework, its role is often simplified in modern Lyra-based architectures due to the delegation of session management tasks to the `UCommonSessionSubsystem`. It primarily serves as a place for specific overrides if the default or subsystem behavior is insufficient.

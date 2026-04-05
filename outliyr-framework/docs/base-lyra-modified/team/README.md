# Team

Welcome to the Team System documentation. This system provides the framework for grouping players and AI into distinct teams, managing their affiliations, applying team-specific visuals, and enabling gameplay logic based on team relationships (e.g., friendly fire, team scoring, objective ownership).

The team system manages team identity, membership, visual representation, and cross-team queries for every actor in a match. It is designed around four principles:

* **Data-driven** — teams are defined in the Experience, not hardcoded. A `ULyraTeamCreationComponent` on the GameState reads a simple `TeamsToCreate` map (team ID to display asset) and builds everything at runtime.
* **Replicated** — team state flows from server to all clients automatically. Each team is represented by a pair of always-relevant info actors that carry the team's ID, tags, and visuals.
* **Visually flexible** — display assets define named color, scalar, and texture parameters that materials and UI read by key. A perspective mode can override these so the local player always sees allies as blue and enemies as red, regardless of actual team IDs.
* **Query-friendly** — the `ULyraTeamSubsystem` answers "is X on the same team as Y?" without the actors knowing about each other. Any system that needs team information goes through this single entry point.

***

## Architecture

{% tabs %}
{% tab title="Simple" %}
```mermaid
flowchart LR
    EXP["Experience"] --> TCC["TeamCreationComponent"]
    TCC -->|spawns per team| PUB["Public Info Actor"]
    TCC -->|spawns per team| PRIV["Private Info Actor"]
    PUB -->|registers on BeginPlay| SUB["TeamSubsystem"]
    PRIV -->|registers on BeginPlay| SUB
    SUB -->|maps TeamID →| DATA["{ PublicInfo, PrivateInfo, DisplayAsset }"]
    PS["PlayerState"] -->|stores TeamID| SUB
    SUB -->|"FindTeamFromObject(Actor)"| QUERY["Gameplay Queries"]
    SUB -->|"GetEffectiveTeamDisplayAsset()"| VIS["Visuals / UI"]
```
{% endtab %}

{% tab title="More Detailed" %}
```mermaid
graph TD
    subgraph "Configuration & Setup"
        Experience["ULyraExperienceDefinition"] -- Contains --> TeamCreationAction["Action: Add ULyraTeamCreationComponent"]
        TeamCreationCompConfig["ULyraTeamCreationComponent (Defaults)"] -- Defines --> TeamsToCreate["TeamsToCreate Map (ID -> DisplayAsset)"]
        TeamDisplayAsset["ULyraTeamDisplayAsset"]
        TeamsToCreate -- Uses --> TeamDisplayAsset
        TeamCreationCompConfig -- Defines --> PerspectiveConfig["PerspectiveColorConfig"]
        PerspectiveConfig -- Uses --> TeamDisplayAsset
    end

    subgraph "Runtime Management"
        TeamSubsystem["ULyraTeamSubsystem (World Subsystem)"]
        TeamInfo["ALyraTeamInfoBase (Public/Private Actor)"]
        TeamAgent["Actor (e.g., PlayerState, Pawn) + ILyraTeamAgentInterface"]
    end

    subgraph "Initialization (Server)"
        TeamCreationAction -- Adds --> TeamCreationCompRuntime["ULyraTeamCreationComponent (Runtime)"] -- Spawns --> TeamInfo
        TeamInfo -- Registers with --> TeamSubsystem
        TeamCreationCompRuntime -- Assigns TeamID to --> TeamAgent
    end

    subgraph "Gameplay Query"
        GameplayLogic["Gameplay Logic / UI"] -- Queries --> TeamSubsystem
        TeamSubsystem -- Finds Team via --> TeamAgent
        TeamSubsystem -- Gets Data from --> TeamInfo
        TeamSubsystem -- Returns --> TeamID["Team ID"]
        TeamSubsystem -- Returns --> EffectiveDisplayAsset["Effective Display Asset (Actual or Perspective)"]
        EffectiveDisplayAsset -- Used by --> GameplayLogic
    end

    TeamDisplayAsset -- Applies Visuals To --> MaterialsVFX["Materials / VFX"]

    style TeamSubsystem fill:#ccf,stroke:#333,stroke-width:2px
    style TeamInfo fill:#ddf,stroke:#333,stroke-width:2px
    style TeamDisplayAsset fill:#dfd,stroke:#333,stroke-width:2px
```

**Explanation:**

1. The active Experience typically adds a subclassed `ULyraTeamCreationComponent` to the Game State.
2. The Creation Component reads its configuration (which teams to create, display assets, perspective settings).
3. On the server, it spawns `ALyraTeamInfoBase` actors for each team and registers them with the `ULyraTeamSubsystem`.
4. It assigns initial Team IDs to players/AI implementing `ILyraTeamAgentInterface`.
5. During gameplay, other systems query the `ULyraTeamSubsystem` to find an actor's team ID or compare affiliations.
6. The subsystem provides team data, including the appropriate `ULyraTeamDisplayAsset` (which might be the actual team's asset or an Ally/Enemy perspective asset).
7. Visual systems use the Display Asset data to apply team colors/textures to actors and UI elements.
{% endtab %}
{% endtabs %}

## Structure of this Section

{% stepper %}
{% step %}
[**Team Model**](team-model.md)

What a team actually is at runtime, info actors, membership interface, display assets, and how they connect.
{% endstep %}

{% step %}
[**Team Setup**](team-setup.md)

How the creation component spawns teams from Experience data, assigns players, and supports asymmetric setups.
{% endstep %}

{% step %}
[**Runtime Queries**](runtime-queries.md)

The subsystem's role: finding teams, comparing teams, friendly fire checks, team tags, and viewer tracking.
{% endstep %}

{% step %}
[**Team Visuals**](team-visuals.md)

Display assets, perspective colors, async actions for reactive UI, and safe color accessors.
{% endstep %}
{% endstepper %}

***

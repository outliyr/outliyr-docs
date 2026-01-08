# Creating New Game modes

#### Questions to ask

Team system

* What is the team structure like? No teams? Multiple teams? Asynchronous teams? Two teams
* How many players will there be in the game mode
* What is the team colouring? Would it be based on perspective (ally team is one colour, all other enemy teams are another colour) or team id (team 1 is one colour, team 2 is another color)?
* Do different teams require different pawns data (useful for asynchronous teams like infection or prop hunt)

Inputs

* Does this game mode require new input actions?
* Does this game mode require new input mappings?
* Does this game mode require new abilities?

Hero Data

* which pawns are available in this game mode?
* what abilities does this pawn have? (What can this pawn do)
* what are the tag relationships between abilities for this pawn? (e.g. action abilities are blocked when the player is dead)
* what are the input mappings for this pawn?
* does this pawn require different widgets? (e.g. props require separate widgets than the hunters in prop hunt)?
* What camera mode does this pawn start with?

User interface

* Does this game mode require unique user interfaces?

Game mode specific features

* Does this game mode require any specific mechanics, functionality or objectives (think safe zone or plane in battle royale, character selection in Arena, control point in domination or dog tags in kill confirmed)

Game mode rules

* Does this game mode have unique rules? (A gamestate component or a blueprint child of ShooterScoring_Base would be created)
* Can the rules be broken up into parts? (e.g Arena has an econmony manager and a character selection manager) Separate logic into separate game state components vs one giant game state component. The better it is separated the more reusable and easier to maintain it becomes?

Experience

* This ties everything together, you can think of this as the chef. The components and features you created are the ingredients, which then gets combined together to produce food. Food in this case is a playable experience or game.
* There can be as many experiences as you want in a game mode, for example (Battle_Royale_Solo, Battle_Royale_Duo, Battle_Royale_Squads, or you could make something like TDM, TDM_Hardcore and TDM_Realism similar to Call Of Duty).&#x20;
* With the experience system you would define everything you want present in that specific playable experience, so things like (UI to give every player, the default pawn to spawn, game features to enable, add components to object, add actions sets which are data assets that include specific functionality for example an action could be a kill cam, it would add tell the experience what to add so that kill cam functionality can be provided to a game mode, etc).

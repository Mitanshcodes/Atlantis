"""Integration fixture only. P1 owns the complete economic simulation."""
import importlib
import os
from .models import Action, MoneyEffect, State, Transition

DEVELOPMENT = True

CLASSES = {
    'newcomer': (90000, None, 0, None),
    'first_of_their_line': (40000, 0, 60000, 580),
    'caretaker': (70000, 0, 0, 620),
    'tidewalker': (50000, None, 0, 540),
}

def new_game(class_id: str, seed: int) -> Transition:
    purse, vault, debt, standing = CLASSES[class_id]
    state = State(class_id=class_id, seed=seed, purse=purse, vault=vault, debt=debt,
                  standing=standing, available_actions=['work', 'buy_kelp'] + (['save', 'withdraw'] if vault is not None else []))
    return Transition(state=state, events=['Development fixture: fixed wages/prices; no season advancement or winning path.'])

def apply_action(state: State, action: Action) -> Transition:
    s = state.model_copy(deep=True)
    if action.kind not in s.available_actions:
        raise ValueError('This action requires the P1 engine')
    source, destination, merchant = 'purse', None, None
    if action.kind == 'work':
        if s.tides < 1:
            raise ValueError('No tides remain in this development slice')
        amount, kind, destination, source = 5000, 'deposit', 'purse', None
        s.purse += amount
        s.tides -= 1
    elif action.kind == 'buy_kelp':
        if s.tides < 1 or action.quantity is None or s.kelp + action.quantity > 60:
            raise ValueError('Choose kelp within cellar capacity and available tides')
        amount, kind, merchant = action.quantity * 400, 'purchase', 'grand_market'
        if s.purse < amount:
            raise ValueError('Insufficient Purse coin')
        s.purse -= amount
        s.kelp += action.quantity
        s.tides -= 1
    elif action.kind in ('save', 'withdraw'):
        if s.vault is None or action.amount is None:
            raise ValueError('A Vault and amount are required')
        amount, kind = action.amount, 'transfer'
        if action.kind == 'save':
            if s.purse < amount:
                raise ValueError('Insufficient Purse coin')
            s.purse -= amount
            s.vault += amount
            destination = 'vault'
        else:
            if s.vault < amount:
                raise ValueError('Insufficient Vault coin')
            s.vault -= amount
            s.purse += amount
            source, destination = 'vault', 'purse'
    else:
        raise ValueError('This action requires the P1 engine')
    s.version += 1
    effect = MoneyEffect(effect_id=action.action_id + ':0', kind=kind, source=source,
                         destination=destination, merchant=merchant, amount=amount, reason=action.kind)
    return Transition(state=s, events=[action.kind], effects=[effect])

def engine():
    mode = os.getenv('ATLANTIS_ENGINE', 'p1')
    if mode == 'development':
        return importlib.import_module(__name__)
    if mode != 'p1':
        raise RuntimeError('ATLANTIS_ENGINE must be development or p1')
    # P1's bridge implements this contract on top of the engine (app/engine/bridge.py).
    module = importlib.import_module('app.engine.bridge')
    if not all(callable(getattr(module, name, None)) for name in ('new_game', 'apply_action')):
        raise RuntimeError('P1 engine does not yet implement the transition contract')
    return module

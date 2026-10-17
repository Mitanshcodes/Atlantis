from ..models import MoneyEffect

def initial_effects(state):
    effects = [MoneyEffect(effect_id='seed:customer', kind='customer', destination='customer', reason='Open citizen profile')]
    for name, balance in [('purse', state.purse), ('vault', state.vault)]:
        if balance is not None:
            effects.append(MoneyEffect(effect_id='seed:' + name, kind='account', destination=name,
                amount=balance, reason='Opening balance', payload={'type': 'Checking' if name == 'purse' else 'Savings'}))
    for name in ('grand_market', 'harbor_exchange', 'passage', 'council', 'black_reef'):
        effects.append(MoneyEffect(effect_id='seed:merchant:' + name, kind='merchant', destination=name, reason=name))
    if state.debt:
        effects.append(MoneyEffect(effect_id='seed:guild', kind='loan', source='purse', destination='guild_loan',
            amount=state.debt, reason='Opening guild obligation', payload={'type': 'personal', 'status': 'approved',
            'credit_score': state.standing, 'monthly_payment': 0}))
    return effects
